# Reports API Usage Examples

## Authentication

All requests require a valid JWT access token in the Authorization header:

```bash
Authorization: Bearer <access_token>
```

## 1. Get Monthly Student Attendance Report

### Basic Request (All Students, Current Month)

```bash
curl -X GET "http://localhost:3001/api/reports/attendance/student/monthly?year=2024&month=11" \
  -H "Authorization: Bearer <access_token>"
```

### Filter by Specific Class

```bash
curl -X GET "http://localhost:3001/api/reports/attendance/student/monthly?year=2024&month=11&classId=<class-uuid>" \
  -H "Authorization: Bearer <access_token>"
```

### Response Example

```json
{
  "year": 2024,
  "month": 11,
  "classId": null,
  "generatedAt": "2024-11-18T17:30:00.000Z",
  "students": [
    {
      "studentId": "550e8400-e29b-41d4-a716-446655440000",
      "admissionId": "ADM001",
      "firstName": "John",
      "lastName": "Doe",
      "studentName": "John Doe",
      "email": "john.doe@example.com",
      "className": "Class A",
      "presentCount": 7,
      "lateCount": 1,
      "absentCount": 2,
      "unmarkedCount": 1,
      "percentage": 80.0,
      "totalMarked": 10
    },
    {
      "studentId": "550e8400-e29b-41d4-a716-446655440001",
      "admissionId": "ADM002",
      "firstName": "Jane",
      "lastName": "Smith",
      "studentName": "Jane Smith",
      "email": "jane.smith@example.com",
      "className": "Class A, Class B",
      "presentCount": 15,
      "lateCount": 0,
      "absentCount": 0,
      "unmarkedCount": 0,
      "percentage": 100.0,
      "totalMarked": 15
    }
  ]
}
```

### Understanding the Response

- `presentCount`: Number of days marked PRESENT
- `lateCount`: Number of days marked LATE
- `absentCount`: Number of days marked ABSENT
- `unmarkedCount`: Number of days with no attendance mark
- `percentage`: Attendance percentage = 100 × (present + late) / (present + late + absent)
- `totalMarked`: Sum of present, late, and absent (excludes unmarked)

### Special Cases

1. **No Marked Entries:**
   ```json
   {
     "studentId": "...",
     "presentCount": 0,
     "lateCount": 0,
     "absentCount": 0,
     "unmarkedCount": 5,
     "percentage": null,
     "totalMarked": 0
   }
   ```

2. **Perfect Attendance:**
   ```json
   {
     "studentId": "...",
     "presentCount": 20,
     "lateCount": 0,
     "absentCount": 0,
     "unmarkedCount": 0,
     "percentage": 100.0,
     "totalMarked": 20
   }
   ```

## 2. Get Student Attendance History

### Basic Request (All Attendance Records)

```bash
curl -X GET "http://localhost:3001/api/reports/attendance/student/<student-uuid>/history" \
  -H "Authorization: Bearer <access_token>"
```

### Filter by Date Range

```bash
curl -X GET "http://localhost:3001/api/reports/attendance/student/<student-uuid>/history?dateFrom=2024-11-01&dateTo=2024-11-30" \
  -H "Authorization: Bearer <access_token>"
```

### Filter by Class

```bash
curl -X GET "http://localhost:3001/api/reports/attendance/student/<student-uuid>/history?classId=<class-uuid>" \
  -H "Authorization: Bearer <access_token>"
```

### Filter by Status

```bash
curl -X GET "http://localhost:3001/api/reports/attendance/student/<student-uuid>/history?status=ABSENT" \
  -H "Authorization: Bearer <access_token>"
```

### Combined Filters

```bash
curl -X GET "http://localhost:3001/api/reports/attendance/student/<student-uuid>/history?dateFrom=2024-11-01&dateTo=2024-11-30&classId=<class-uuid>&status=PRESENT" \
  -H "Authorization: Bearer <access_token>"
```

### Response Example

```json
[
  {
    "id": "attendance-record-uuid-1",
    "studentId": "student-uuid",
    "className": "Class A",
    "attendanceDate": "2024-11-18T00:00:00.000Z",
    "status": "PRESENT",
    "remarks": "On time",
    "markedBy": "teacher-user-uuid",
    "markedAt": "2024-11-18T09:05:00.000Z"
  },
  {
    "id": "attendance-record-uuid-2",
    "studentId": "student-uuid",
    "className": "Class A",
    "attendanceDate": "2024-11-17T00:00:00.000Z",
    "status": "LATE",
    "remarks": "Arrived 10 minutes late",
    "markedBy": "teacher-user-uuid",
    "markedAt": "2024-11-17T09:15:00.000Z"
  },
  {
    "id": "attendance-record-uuid-3",
    "studentId": "student-uuid",
    "className": "Class A",
    "attendanceDate": "2024-11-16T00:00:00.000Z",
    "status": "ABSENT",
    "remarks": "Sick leave",
    "markedBy": "teacher-user-uuid",
    "markedAt": "2024-11-16T14:30:00.000Z"
  }
]
```

## JavaScript/TypeScript Examples

### Using Axios

```typescript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';
const accessToken = 'your-access-token';

// Get monthly report
async function getMonthlyReport(year: number, month: number, classId?: string) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/reports/attendance/student/monthly`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          year,
          month,
          classId,
        },
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error fetching monthly report:', error);
    throw error;
  }
}

// Get student history
async function getStudentHistory(
  studentId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    classId?: string;
    status?: 'PRESENT' | 'ABSENT' | 'LATE';
  }
) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/reports/attendance/student/${studentId}/history`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: filters,
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error fetching student history:', error);
    throw error;
  }
}

// Usage examples
async function examples() {
  // Get November 2024 report for all students
  const report = await getMonthlyReport(2024, 11);
  console.log('Monthly Report:', report);
  
  // Get report for specific class
  const classReport = await getMonthlyReport(2024, 11, 'class-uuid-here');
  console.log('Class Report:', classReport);
  
  // Get student's attendance history
  const history = await getStudentHistory('student-uuid-here');
  console.log('Student History:', history);
  
  // Get student's absences in November 2024
  const absences = await getStudentHistory('student-uuid-here', {
    dateFrom: '2024-11-01',
    dateTo: '2024-11-30',
    status: 'ABSENT',
  });
  console.log('November Absences:', absences);
}
```

### Using Fetch API

```typescript
const API_BASE_URL = 'http://localhost:3001/api';
const accessToken = 'your-access-token';

// Get monthly report
async function getMonthlyReport(year: number, month: number) {
  const params = new URLSearchParams({
    year: year.toString(),
    month: month.toString(),
  });
  
  const response = await fetch(
    `${API_BASE_URL}/reports/attendance/student/monthly?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}
```

## React Hook Example

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

interface MonthlyReport {
  year: number;
  month: number;
  classId: string | null;
  generatedAt: string;
  students: Array<{
    studentId: string;
    admissionId: string;
    studentName: string;
    className: string;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    unmarkedCount: number;
    percentage: number | null;
    totalMarked: number;
  }>;
}

function useMonthlyReport(year: number, month: number, classId?: string) {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          '/api/reports/attendance/student/monthly',
          {
            params: { year, month, classId },
          }
        );
        setReport(response.data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReport();
  }, [year, month, classId]);
  
  return { report, loading, error };
}

// Usage in component
function MonthlyReportComponent() {
  const { report, loading, error } = useMonthlyReport(2024, 11);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!report) return null;
  
  return (
    <div>
      <h2>Monthly Report - {report.month}/{report.year}</h2>
      <table>
        <thead>
          <tr>
            <th>Student Name</th>
            <th>Class</th>
            <th>Present</th>
            <th>Late</th>
            <th>Absent</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          {report.students.map((student) => (
            <tr key={student.studentId}>
              <td>{student.studentName}</td>
              <td>{student.className}</td>
              <td>{student.presentCount}</td>
              <td>{student.lateCount}</td>
              <td>{student.absentCount}</td>
              <td>
                {student.percentage !== null
                  ? `${student.percentage.toFixed(1)}%`
                  : 'No marked entries'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## Error Responses

### 400 Bad Request - Invalid Month

```json
{
  "statusCode": 400,
  "message": "Invalid month. Must be between 1 and 12.",
  "error": "Bad Request"
}
```

### 401 Unauthorized - No Token

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden - Student Accessing Others' Data

```json
{
  "statusCode": 403,
  "message": "Students can only view their own attendance records",
  "error": "Forbidden"
}
```

### 404 Not Found - Invalid Class ID

```json
{
  "statusCode": 404,
  "message": "Class with ID class-uuid-here not found",
  "error": "Not Found"
}
```

## Best Practices

1. **Caching:** Consider caching monthly reports as they don't change frequently
2. **Pagination:** For large datasets, implement pagination on the frontend
3. **Date Validation:** Validate date ranges on the frontend before sending requests
4. **Error Handling:** Always implement proper error handling for network failures
5. **Loading States:** Show loading indicators while fetching reports
6. **Timezone Awareness:** Remember that dates are in Asia/Kolkata timezone

## Performance Tips

1. **Use Class Filtering:** When possible, filter by class ID to reduce data size
2. **Date Range Limiting:** Use appropriate date ranges to limit history results
3. **Batch Requests:** If fetching multiple students' histories, consider batching
4. **Frontend Caching:** Cache reports that don't change frequently
