'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
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
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error || 'No data available'}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { userCounts, todayAttendance, recentActivity } = dashboardData;

  const calculatePercentage = (numerator: number, denominator: number) => {
    if (denominator === 0) return '0';
    return ((numerator / denominator) * 100).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Administrator Dashboard</h1>
          <p className="text-gray-600 mt-2">Overview of system activity and attendance</p>
        </div>

        {/* User Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-600">Total Users</span>
              <span className="text-3xl font-bold text-gray-900 mt-2">
                {userCounts.totalUsers}
              </span>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-600">Active Students</span>
              <span className="text-3xl font-bold text-blue-600 mt-2">
                {userCounts.activeStudents}
              </span>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-600">Active Staff</span>
              <span className="text-3xl font-bold text-green-600 mt-2">
                {userCounts.activeStaff}
              </span>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-600">Administrators</span>
              <span className="text-3xl font-bold text-purple-600 mt-2">
                {userCounts.totalAdmins}
              </span>
            </div>
          </Card>
        </div>

        {/* Today's Attendance Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Student Attendance Today */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Student Attendance Today
            </h2>
            <p className="text-sm text-gray-600 mb-4">Date: {todayAttendance.date}</p>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Total Students:</span>
                <span className="font-semibold">{todayAttendance.students.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Marked:</span>
                <span className="font-semibold text-blue-600">
                  {todayAttendance.students.marked} (
                  {calculatePercentage(
                    todayAttendance.students.marked,
                    todayAttendance.students.total
                  )}%)
                </span>
              </div>
              <div className="h-px bg-gray-200"></div>
              <div className="flex justify-between items-center">
                <span className="text-green-600">Present:</span>
                <span className="font-semibold text-green-600">
                  {todayAttendance.students.present}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-yellow-600">Late:</span>
                <span className="font-semibold text-yellow-600">
                  {todayAttendance.students.late}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-600">Absent:</span>
                <span className="font-semibold text-red-600">
                  {todayAttendance.students.absent}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Unmarked:</span>
                <span className="font-semibold text-gray-500">
                  {todayAttendance.students.unmarked}
                </span>
              </div>
            </div>
          </Card>

          {/* Staff Attendance Today */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Staff Attendance Today
            </h2>
            <p className="text-sm text-gray-600 mb-4">Date: {todayAttendance.date}</p>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Total Staff:</span>
                <span className="font-semibold">{todayAttendance.staff.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Marked:</span>
                <span className="font-semibold text-blue-600">
                  {todayAttendance.staff.marked} (
                  {calculatePercentage(
                    todayAttendance.staff.marked,
                    todayAttendance.staff.total
                  )}%)
                </span>
              </div>
              <div className="h-px bg-gray-200"></div>
              <div className="flex justify-between items-center">
                <span className="text-green-600">Present:</span>
                <span className="font-semibold text-green-600">
                  {todayAttendance.staff.present}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-yellow-600">Late:</span>
                <span className="font-semibold text-yellow-600">
                  {todayAttendance.staff.late}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-600">Absent:</span>
                <span className="font-semibold text-red-600">
                  {todayAttendance.staff.absent}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Unmarked:</span>
                <span className="font-semibold text-gray-500">
                  {todayAttendance.staff.unmarked}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Attendance Activity */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Recent Attendance Registers
          </h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Present
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Late
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Absent
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No recent attendance activity
                    </td>
                  </tr>
                ) : (
                  recentActivity.map((activity) => (
                    <tr key={activity.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(activity.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {activity.className}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            activity.status === 'SAVED'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {activity.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {activity.markedStudents} / {activity.totalStudents}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        {activity.presentCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium">
                        {activity.lateCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        {activity.absentCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
