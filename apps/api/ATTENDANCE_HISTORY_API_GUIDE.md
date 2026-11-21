# Attendance History API - Quick Reference Guide

## Overview

This guide provides quick reference for the attendance history and filtering endpoints implemented in Task 20.

## Endpoints

### 1. Get Student Attendance History

**Endpoint**: `GET /students/:id/attendance`

**Authorization**: JWT Bearer Token (ADMINISTRATOR or STUDENT role)

**Access Control**:
- Administrators can view any student's attendance
- Students can only view their own attendance

**Path Parameters**:
- `id` (required): Student UUID

**Query Parameters** (all optional):
| Parameter | Type | Example | Description |
|-----------|------|---------|-------------|
| `classId` | UUID | `abc123...` | Filter by specific class |
| `dateFrom` | ISO Date | `2024-01-01` | Start date for range filter |
| `dateTo` | ISO Date | `2024-12-31` | End date for range filter |
| `status` | Enum | `PRESENT`, `ABSENT`, `LATE` | Filter by attendance status |

**Example Requests**:

```bash
# Get all attendance for a student
curl -X GET \
  'http://localhost:3000/students/123e4567-e89b-12d3-a456-426614174000/attendance' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Filter by date range
curl -X GET \
  'http://localhost:3000/students/123e4567-e89b-12d3-a456-426614174000/attendance?dateFrom=2024-01-01&dateTo=2024-01-31' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Filter by class and status
curl -X GET \
  'http://localhost:3000/students/123e4567-e89b-12d3-a456-426614174000/attendance?classId=abc123...&status=PRESENT' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Combine all filters
curl -X GET \
  'http://localhost:3000/students/123e4567-e89b-12d3-a456-426614174000/attendance?classId=abc123...&dateFrom=2024-01-01&dateTo=2024-01-31&status=LATE' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

**Response**:
```json
[
  {
    "id": "att-uuid-1",
    "studentId": "student-uuid",
    "studentName": "John Doe",
    "admissionId": "STU2024001",
    "classId": "class-uuid",
    "className": "Class A",
    "attendanceDate": "2024-01-15T00:00:00.000Z",
    "status": "PRESENT",
    "remarks": "On time",
    "markedBy": "admin-uuid",
    "markedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

**Status Codes**:
- `200 OK`: Success
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Student accessing another student's data
- `404 Not Found`: Student not found

---

### 2. Get All Students Attendance History

**Endpoint**: `GET /students/attendance/all`

**Authorization**: JWT Bearer Token (ADMINISTRATOR role only)

**Query Parameters** (all optional):
| Parameter | Type | Example | Description |
|-----------|------|---------|-------------|
| `studentId` | UUID | `student-uuid` | Filter by specific student |
| `classId` | UUID | `abc123...` | Filter by specific class |
| `dateFrom` | ISO Date | `2024-01-01` | Start date for range filter |
| `dateTo` | ISO Date | `2024-12-31` | End date for range filter |
| `status` | Enum | `PRESENT`, `ABSENT`, `LATE` | Filter by attendance status |

**Example Requests**:

```bash
# Get all attendance records
curl -X GET \
  'http://localhost:3000/students/attendance/all' \
  -H 'Authorization: Bearer ADMIN_TOKEN'

# Filter by class
curl -X GET \
  'http://localhost:3000/students/attendance/all?classId=abc123...' \
  -H 'Authorization: Bearer ADMIN_TOKEN'

# Filter by date range and status
curl -X GET \
  'http://localhost:3000/students/attendance/all?dateFrom=2024-01-01&dateTo=2024-01-31&status=ABSENT' \
  -H 'Authorization: Bearer ADMIN_TOKEN'

# Filter for specific student
curl -X GET \
  'http://localhost:3000/students/attendance/all?studentId=student-uuid' \
  -H 'Authorization: Bearer ADMIN_TOKEN'
```

**Response**: Same format as endpoint 1 (array of attendance records)

**Status Codes**:
- `200 OK`: Success
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Non-administrator trying to access

---

## Use Cases

### Use Case 1: Student Views Own Attendance

**Scenario**: Student wants to check their attendance for the current month

**Request**:
```bash
GET /students/their-student-id/attendance?dateFrom=2024-11-01&dateTo=2024-11-30
Authorization: Bearer STUDENT_TOKEN
```

**Expected**: List of their attendance records for November 2024

---

### Use Case 2: Generate Class Attendance Report

**Scenario**: Administrator wants to see all absences in a specific class for a week

**Request**:
```bash
GET /students/attendance/all?classId=class-uuid&status=ABSENT&dateFrom=2024-11-11&dateTo=2024-11-17
Authorization: Bearer ADMIN_TOKEN
```

**Expected**: List of all absent records for that class during the week

---

### Use Case 3: Monitor Late Arrivals

**Scenario**: Administrator wants to identify students who arrived late in the past month

**Request**:
```bash
GET /students/attendance/all?status=LATE&dateFrom=2024-10-01&dateTo=2024-10-31
Authorization: Bearer ADMIN_TOKEN
```

**Expected**: List of all late arrival records across all students and classes

---

### Use Case 4: Student Attendance Summary

**Scenario**: Administrator needs complete attendance history for a specific student

**Request**:
```bash
GET /students/student-uuid/attendance
Authorization: Bearer ADMIN_TOKEN
```

**Expected**: All attendance records for that student, ordered by date descending

---

## Error Handling

### 400 Bad Request

**Cause**: Invalid date format or invalid enum value

**Example Response**:
```json
{
  "statusCode": 400,
  "message": [
    "dateFrom must be a valid ISO 8601 date string"
  ],
  "error": "Bad Request"
}
```

**Solution**: Use ISO date format (YYYY-MM-DD) and valid status values

---

### 401 Unauthorized

**Cause**: Missing or invalid JWT token

**Example Response**:
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Solution**: Include valid Bearer token in Authorization header

---

### 403 Forbidden

**Cause**: Insufficient permissions or student accessing another's data

**Example Response**:
```json
{
  "statusCode": 403,
  "message": "Students can only view their own attendance records",
  "error": "Forbidden"
}
```

**Solution**: Students should only request their own attendance records

---

### 404 Not Found

**Cause**: Student ID doesn't exist

**Example Response**:
```json
{
  "statusCode": 404,
  "message": "Student not found",
  "error": "Not Found"
}
```

**Solution**: Verify the student ID is correct

---

## Query Tips

### Efficient Date Queries

**Good**: Use specific date ranges
```
?dateFrom=2024-01-01&dateTo=2024-01-31
```

**Avoid**: Fetching all records without filters (can be slow with large datasets)

### Combining Filters

You can combine any filters to narrow down results:
```
?classId=abc123&dateFrom=2024-01-01&dateTo=2024-01-31&status=ABSENT
```

This finds all absences in a specific class during January 2024.

### Default Ordering

All results are automatically ordered by `attendanceDate` in **descending order** (newest first). No need to specify ordering.

---

## Testing

### Prerequisites

1. API server running on http://localhost:3000
2. Valid JWT tokens for testing:
   - Admin token for full access
   - Student token for student-only access
3. At least one student with attendance records
4. At least one class in the system

### Quick Test

```bash
# Run the automated test script
cd apps/api
node test-attendance-history.js
```

This will run 8 automated tests covering all functionality.

---

## Integration Examples

### JavaScript/TypeScript (Axios)

```typescript
import axios from 'axios';

// Get student attendance with filters
async function getStudentAttendance(
  studentId: string,
  filters: {
    classId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: 'PRESENT' | 'ABSENT' | 'LATE';
  },
  token: string
) {
  const params = new URLSearchParams();
  if (filters.classId) params.append('classId', filters.classId);
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  if (filters.status) params.append('status', filters.status);

  const response = await axios.get(
    `http://localhost:3000/students/${studentId}/attendance?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  return response.data;
}

// Example usage
const attendance = await getStudentAttendance(
  'student-uuid',
  {
    dateFrom: '2024-01-01',
    dateTo: '2024-01-31',
    status: 'PRESENT'
  },
  'your-jwt-token'
);
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

function useStudentAttendance(studentId: string, filters: any) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAttendance() {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const params = new URLSearchParams(filters);
        
        const response = await axios.get(
          `http://localhost:3000/students/${studentId}/attendance?${params}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        setData(response.data);
        setError(null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchAttendance();
  }, [studentId, JSON.stringify(filters)]);

  return { data, loading, error };
}

// Usage in component
function AttendanceView({ studentId }) {
  const { data, loading, error } = useStudentAttendance(studentId, {
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31'
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      {data.map(record => (
        <div key={record.id}>
          {record.attendanceDate}: {record.status} ({record.className})
        </div>
      ))}
    </div>
  );
}
```

---

## Performance Notes

- Queries use database indexes on `studentId`, `classId`, and `attendanceDate`
- Date range queries are optimized with `gte`/`lte` operators
- Results are ordered at the database level (efficient)
- Consider pagination for very large result sets (future enhancement)

---

## Related Endpoints

- `POST /attendance/student/registers` - Open attendance register
- `POST /attendance/student/registers/:id/mark` - Mark student attendance
- `GET /reports/attendance/student/monthly` - Monthly attendance reports (Task 18)

---

## Support

For issues or questions about these endpoints:
1. Check the implementation summary: `TASK_20_IMPLEMENTATION_SUMMARY.md`
2. Review the unit tests: `src/students/students.service.spec.ts`
3. Run the integration tests: `node test-attendance-history.js`
