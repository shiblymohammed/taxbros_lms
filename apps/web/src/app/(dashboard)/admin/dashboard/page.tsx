'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, GraduationCap, RotateCcw, ShieldCheck, UserCog, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { RouteLoading } from '@/components/shared/route-states';
import { StatCard } from '@/components/shared/stat-card';
import { AttendanceSummaryCard } from '@/components/features/attendance/attendance-summary-card';
import { apiClient } from '@/lib/api';

interface DashboardData {
  userCounts: {
    totalUsers: number;
    activeStudents: number;
    activeStaff: number;
    totalAdmins: number;
  };
  todayAttendance: {
    date: string;
    students: {
      total: number;
      marked: number;
      present: number;
      absent: number;
      late: number;
      unmarked: number;
    };
    staff: {
      total: number;
      marked: number;
      present: number;
      absent: number;
      late: number;
      unmarked: number;
    };
  };
  recentActivity: Array<{
    id: string;
    date: string;
    className: string;
    classId: string;
    status: string;
    totalStudents: number;
    markedStudents: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
  }>;
}

export default function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<DashboardData>('/dashboard/admin');
      setDashboardData(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return <RouteLoading label="Loading dashboard…" />;
  }

  if (error || !dashboardData) {
    return (
      <PageContainer>
        <div className="flex min-h-[50vh] flex-col items-center justify-center text-center" role="alert">
          <p className="text-lg text-red-600">{error || 'No data available'}</p>
          <Button onClick={fetchDashboardData} className="mt-4">
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </PageContainer>
    );
  }

  const { userCounts, todayAttendance, recentActivity } = dashboardData;

  return (
    <PageContainer>
      <PageHeader
        title="Administrator Dashboard"
        description="Overview of users, today's attendance and recent class registers"
        actions={
          <Button asChild variant="outline">
            <Link href="/staff/attendance">
              Open class register <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <section aria-label="Users" className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total Users" value={userCounts.totalUsers} icon={Users} tone="slate" />
        <StatCard label="Active Students" value={userCounts.activeStudents} icon={GraduationCap} tone="blue" />
        <StatCard label="Active Staff" value={userCounts.activeStaff} icon={UserCog} tone="green" />
        <StatCard label="Administrators" value={userCounts.totalAdmins} icon={ShieldCheck} tone="orange" />
      </section>

      <section aria-label={`Attendance on ${todayAttendance.date}`} className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttendanceSummaryCard title="Student attendance today" totalLabel="Students" counts={todayAttendance.students} />
        <AttendanceSummaryCard title="Staff attendance today" totalLabel="Staff" counts={todayAttendance.staff} />
      </section>

      <Card className="overflow-hidden shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent attendance registers</h2>
            <p className="mt-0.5 text-sm text-slate-500">Latest class registers across all batches</p>
          </div>
          <Link href="/admin/reports/attendance" className="hidden text-sm font-medium text-brand-strong hover:underline sm:inline">
            View reports
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-6 py-3">Date</th>
                <th scope="col" className="px-6 py-3">Class</th>
                <th scope="col" className="px-6 py-3">Status</th>
                <th scope="col" className="px-6 py-3">Progress</th>
                <th scope="col" className="px-6 py-3 text-right">Present</th>
                <th scope="col" className="px-6 py-3 text-right">Late</th>
                <th scope="col" className="px-6 py-3 text-right">Absent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    No recent attendance activity
                  </td>
                </tr>
              ) : (
                recentActivity.map((activity) => {
                  const pct = activity.totalStudents > 0 ? Math.round((activity.markedStudents / activity.totalStudents) * 100) : 0;
                  return (
                    <tr key={activity.id} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                        {new Date(activity.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">{activity.className}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Badge
                          variant="outline"
                          className={
                            activity.status === 'SAVED'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          }
                        >
                          {activity.status === 'SAVED' ? 'Saved' : 'Draft'}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="tabular-nums text-slate-600">
                            {activity.markedStudents}/{activity.totalStudents}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-medium tabular-nums text-emerald-600">{activity.presentCount}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-medium tabular-nums text-amber-600">{activity.lateCount}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-medium tabular-nums text-red-600">{activity.absentCount}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}
