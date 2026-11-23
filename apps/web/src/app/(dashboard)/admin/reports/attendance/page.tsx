'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Calendar, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { reportsApi, classesApi, type MonthlyStudentAttendanceRow } from '@/lib/api';
import { exportToCSV } from '@/lib/csv-export';
import { averageAttendance } from '@/lib/report-stats';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

interface Class {
  id: string;
  name: string;
}

export default function MonthlyReportsPage() {
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [classes, setClasses] = useState<Class[]>([]);
  const [reportData, setReportData] = useState<MonthlyStudentAttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const data = await classesApi.getAll();
        setClasses(data);
      } catch (err) {
        console.error('Failed to fetch classes:', err);
      }
    };
    fetchClasses();
  }, []);

  // Only the latest request may update the table (a slow earlier one could arrive last)
  const requestId = useRef(0);

  const fetchReport = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const params: any = {
        year: selectedYear,
        month: selectedMonth,
      };
      
      if (selectedClassId !== 'all') {
        params.classId = selectedClassId;
      }

      const report = await reportsApi.getMonthlyStudentReport(params);
      if (id === requestId.current) setReportData(report.students);
    } catch (err: any) {
      if (id !== requestId.current) return;
      setError(err.response?.data?.message || 'Failed to fetch report');
      console.error('Failed to fetch report:', err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedClassId]);

  // Fetch report data when filters change
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportToCSV = () => {
    if (reportData.length === 0) return; // the button is disabled when there is nothing to export

    const exportData = reportData.map(row => ({
      'Student Name': row.studentName,
      'Admission ID': row.admissionId,
      'Class': row.className,
      'Present': row.presentCount,
      'Late': row.lateCount,
      'Absent': row.absentCount,
      'Unmarked': row.unmarkedCount,
      'Attendance %': row.percentage !== null ? `${row.percentage.toFixed(2)}%` : 'N/A',
    }));

    const monthName = months.find(m => m.value === selectedMonth)?.label || selectedMonth;
    const filename = `attendance_report_${monthName}_${selectedYear}.csv`;
    exportToCSV(exportData, filename);
  };

  const formatPercentage = (percentage: number | null) => {
    if (percentage === null) {
      return <span className="text-muted-foreground">N/A</span>;
    }
    
    let colorClass = 'text-green-600';
    if (percentage < 75) {
      colorClass = 'text-red-600';
    } else if (percentage < 85) {
      colorClass = 'text-yellow-600';
    }
    
    return <span className={`font-semibold ${colorClass}`}>{percentage.toFixed(2)}%</span>;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Monthly Attendance Reports</h1>
        <p className="text-muted-foreground">
          View and export monthly attendance reports for students
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Report Filters
          </CardTitle>
          <CardDescription>
            Select the month, year, and class to generate the attendance report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year-select">Year</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger id="year-select">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="month-select">Month</Label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger id="month-select">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-select">Class</Label>
              <Select
                value={selectedClassId}
                onValueChange={setSelectedClassId}
              >
                <SelectTrigger id="class-select">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 flex items-end">
              <Button
                onClick={handleExportToCSV}
                disabled={loading || reportData.length === 0}
                className="w-full"
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Export to CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attendance Report - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
          </CardTitle>
          <CardDescription>
            Showing attendance data for {reportData.length} student{reportData.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-muted-foreground">Loading report...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-2">Error loading report</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={fetchReport} className="mt-4" variant="outline">
                Try Again
              </Button>
            </div>
          ) : reportData.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No attendance data found for the selected period</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Admission ID</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Late</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Unmarked</TableHead>
                    <TableHead className="text-center">Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((row) => (
                    <TableRow key={row.studentId}>
                      <TableCell className="font-medium">{row.studentName}</TableCell>
                      <TableCell>{row.admissionId}</TableCell>
                      <TableCell>{row.className}</TableCell>
                      <TableCell className="text-center">{row.presentCount}</TableCell>
                      <TableCell className="text-center">{row.lateCount}</TableCell>
                      <TableCell className="text-center">{row.absentCount}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{row.unmarkedCount}</TableCell>
                      <TableCell className="text-center">{formatPercentage(row.percentage)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {reportData.length > 0 && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="text-sm font-semibold mb-2">Summary Statistics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Students</p>
                  <p className="text-lg font-semibold">{reportData.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg Attendance</p>
                  <p className="text-lg font-semibold">
                    {averageAttendance(reportData)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Present</p>
                  <p className="text-lg font-semibold">
                    {reportData.reduce((sum, row) => sum + row.presentCount, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Absent</p>
                  <p className="text-lg font-semibold">
                    {reportData.reduce((sum, row) => sum + row.absentCount, 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
