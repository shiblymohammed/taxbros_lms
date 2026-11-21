# Student Attendance Marking - Usage Examples

This document provides comprehensive examples for using the student attendance marking and correction API endpoints.

## Table of Contents

1. [Basic Marking](#basic-marking)
2. [Correction Workflow](#correction-workflow)
3. [Partial Marking](#partial-marking)
4. [Error Scenarios](#error-scenarios)
5. [Frontend Integration](#frontend-integration)
6. [TypeScript Examples](#typescript-examples)

## Basic Marking

### Scenario 1: Mark All Students in Register

**Context**: Teacher opens register in the morning and marks all students at once.

**Step 1: Open Register**
```bash
POST /attendance/student/registers
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "classId": "class-uuid-123",
  "attendanceDate": "2024-11-18"
}
```

**Response:**
```json
{
  "id": "register-uuid-456",
  "classId": "class-uuid-123",
  "className": "Class 10A",
  "attendanceDate": "2024-11-18T00:00:00.000Z",
  "status": "DRAFT",
  "students": [
    {
      "studentId": "student-1",
      "admissionId": "ADM001",
      "firstName": "Alice",
      "lastName": "Smith",
      "status": null,
      "remarks": null,
      "markedAt": null
    },
    {
      "studentId": "student-2",
      "admissionId": "ADM002",
      "firstName": "Bob",
      "lastName": "Jones",
      "status": null,
      "remarks": null,
      "markedAt": null
    },
    {
      "studentId": "student-3",
      "admissionId": "ADM003",
      "firstName": "Charlie",
      "lastName": "Brown",
      "status": null,
      "remarks": null,
      "markedAt": null
    }
  ],
  "createdAt": "2024-11-18T08:00:00.000Z",
  "updatedAt": "2024-11-18T08:00:00.000Z"
}
```

**Step 2: Mark All Attendance**
```bash
POST /attendance/student/registers/register-uuid-456/mark
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "marks": [
    {
      "studentId": "student-1",
      "status": "PRESENT"
    },
    {
      "studentId": "student-2",
      "status": "ABSENT",
      "remarks": "Called in sick"
    },
    {
      "studentId": "student-3",
      "status": "LATE",
      "remarks": "Arrived at 9:15 AM"
    }
  ]
}
```

**Response:**
```json
{
  "id": "register-uuid-456",
  "classId": "class-uuid-123",
  "className": "Class 10A",
  "attendanceDate": "2024-11-18T00:00:00.000Z",
  "status": "SAVED",
  "students": [
    {
      "studentId": "student-1",
      "admissionId": "ADM001",
      "firstName": "Alice",
      "lastName": "Smith",
      "status": "PRESENT",
      "remarks": null,
      "markedAt": "2024-11-18T09:00:00.000Z"
    },
    {
      "studentId": "student-2",
      "admissionId": "ADM002",
      "firstName": "Bob",
      "lastName": "Jones",
      "status": "ABSENT",
      "remarks": "Called in sick",
      "markedAt": "2024-11-18T09:00:00.000Z"
    },
    {
      "studentId": "student-3",
      "admissionId": "ADM003",
      "firstName": "Charlie",
      "lastName": "Brown",
      "status": "LATE",
      "remarks": "Arrived at 9:15 AM",
      "markedAt": "2024-11-18T09:00:00.000Z"
    }
  ],
  "createdAt": "2024-11-18T08:00:00.000Z",
  "updatedAt": "2024-11-18T09:00:00.000Z"
}
```

**Key Points**:
- Register status changed from `DRAFT` to `SAVED`
- All students now have status and `markedAt` timestamp
- `remarks` field is optional and can be null
- Single API call marks all students

## Correction Workflow

### Scenario 2: Correct Previously Marked Attendance

**Context**: Bob provided a doctor's note after being marked absent. Teacher needs to change his status to PRESENT.

**Request:**
```bash
POST /attendance/student/registers/register-uuid-456/mark
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "marks": [
    {
      "studentId": "student-2",
      "status": "PRESENT",
      "remarks": "Doctor's note provided - excused absence counted as present"
    }
  ]
}
```

**Response:**
```json
{
  "id": "register-uuid-456",
  "classId": "class-uuid-123",
  "className": "Class 10A",
  "attendanceDate": "2024-11-18T00:00:00.000Z",
  "status": "SAVED",
  "students": [
    {
      "studentId": "student-1",
      "admissionId": "ADM001",
      "firstName": "Alice",
      "lastName": "Smith",
      "status": "PRESENT",
      "remarks": null,
      "markedAt": "2024-11-18T09:00:00.000Z"
    },
    {
      "studentId": "student-2",
      "admissionId": "ADM002",
      "firstName": "Bob",
      "lastName": "Jones",
      "status": "PRESENT",
      "remarks": "Doctor's note provided - excused absence counted as present",
      "markedAt": "2024-11-18T14:30:00.000Z"
    },
    {
      "studentId": "student-3",
      "admissionId": "ADM003",
      "firstName": "Charlie",
      "lastName": "Brown",
      "status": "LATE",
      "remarks": "Arrived at 9:15 AM",
      "markedAt": "2024-11-18T09:00:00.000Z"
    }
  ],
  "createdAt": "2024-11-18T08:00:00.000Z",
  "updatedAt": "2024-11-18T14:30:00.000Z"
}
```

**Key Points**:
- Only Bob's status was updated (ABSENT → PRESENT)
- Bob's `markedAt` timestamp updated to reflect correction time
- Other students' attendance unchanged
- Register status remains `SAVED`
- Audit trail preserved with new `markedAt` time

### Scenario 3: Multiple Corrections

**Context**: Teacher reviews attendance at end of day and makes multiple corrections.

**Request:**
```bash
POST /attendance/student/registers/register-uuid-456/mark
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "marks": [
    {
      "studentId": "student-3",
      "status": "PRESENT",
      "remarks": "Actually arrived on time - corrected"
    },
    {
      "studentId": "student-1",
      "status": "LATE",
      "remarks": "Left early at 2 PM for appointment"
    }
  ]
}
```

**Response:**
```json
{
  "id": "register-uuid-456",
  "status": "SAVED",
  "students": [
    {
      "studentId": "student-1",
      "status": "LATE",
      "remarks": "Left early at 2 PM for appointment",
      "markedAt": "2024-11-18T16:00:00.000Z"
    },
    {
      "studentId": "student-2",
      "status": "PRESENT",
      "remarks": "Doctor's note provided - excused absence counted as present",
      "markedAt": "2024-11-18T14:30:00.000Z"
    },
    {
      "studentId": "student-3",
      "status": "PRESENT",
      "remarks": "Actually arrived on time - corrected",
      "markedAt": "2024-11-18T16:00:00.000Z"
    }
  ]
}
```

**Key Points**:
- Multiple students corrected in single request
- Each correction has independent `markedAt` timestamp (all at 16:00 in this batch)
- All corrections logged in audit trail

## Partial Marking

### Scenario 4: Mark Attendance Incrementally

**Context**: Teacher marks students as they arrive throughout the morning.

**9:00 AM - Mark early arrivals:**
```bash
POST /attendance/student/registers/register-uuid-456/mark

{
  "marks": [
    {
      "studentId": "student-1",
      "status": "PRESENT"
    }
  ]
}
```

**9:15 AM - Mark late arrival:**
```bash
POST /attendance/student/registers/register-uuid-456/mark

{
  "marks": [
    {
      "studentId": "student-3",
      "status": "LATE",
      "remarks": "Traffic delay"
    }
  ]
}
```

**10:00 AM - Mark absent students:**
```bash
POST /attendance/student/registers/register-uuid-456/mark

{
  "marks": [
    {
      "studentId": "student-2",
      "status": "ABSENT"
    }
  ]
}
```

**Final State:**
```json
{
  "id": "register-uuid-456",
  "status": "SAVED",
  "students": [
    {
      "studentId": "student-1",
      "status": "PRESENT",
      "markedAt": "2024-11-18T09:00:00.000Z"
    },
    {
      "studentId": "student-2",
      "status": "ABSENT",
      "markedAt": "2024-11-18T10:00:00.000Z"
    },
    {
      "studentId": "student-3",
      "status": "LATE",
      "remarks": "Traffic delay",
      "markedAt": "2024-11-18T09:15:00.000Z"
    }
  ]
}
```

**Key Points**:
- Register status changed to `SAVED` after first mark
- Each student has their own `markedAt` time
- Unmarked students not affected by partial marking
- Flexible workflow supports gradual attendance taking

## Error Scenarios

### Error 1: Register Not Found

**Request:**
```bash
POST /attendance/student/registers/invalid-uuid/mark
```

**Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Register with ID invalid-uuid not found",
  "error": "Not Found"
}
```

### Error 2: Student Not in Roster

**Context**: Trying to mark a student who wasn't enrolled when register was created.

**Request:**
```bash
POST /attendance/student/registers/register-uuid-456/mark

{
  "marks": [
    {
      "studentId": "student-999",
      "status": "PRESENT"
    }
  ]
}
```

**Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Student student-999 is not in the register roster",
  "error": "Bad Request"
}
```

**Key Points**:
- Frozen roster validation prevents marking unenrolled students
- Students who enrolled after register creation cannot be marked
- Need to create new register or adjust enrollment first

### Error 3: Invalid Status Value

**Request:**
```bash
POST /attendance/student/registers/register-uuid-456/mark

{
  "marks": [
    {
      "studentId": "student-1",
      "status": "SICK"
    }
  ]
}
```

**Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": [
    "status must be one of the following values: PRESENT, ABSENT, LATE"
  ],
  "error": "Bad Request"
}
```

### Error 4: Unauthorized Access

**Request (no JWT token):**
```bash
POST /attendance/student/registers/register-uuid-456/mark

{
  "marks": [...]
}
```

**Response (401 Unauthorized):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### Error 5: Insufficient Permissions

**Context**: Student trying to mark attendance (only ADMINISTRATOR and STAFF allowed).

**Response (403 Forbidden):**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

## Frontend Integration

### React Example with Axios

```typescript
import axios from 'axios';
import { useState } from 'react';

interface AttendanceMark {
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  remarks?: string;
}

function AttendanceMarking() {
  const [marks, setMarks] = useState<AttendanceMark[]>([]);
  const [registerId, setRegisterId] = useState<string>('');

  const markAttendance = async () => {
    try {
      const response = await axios.post(
        `/attendance/student/registers/${registerId}/mark`,
        { marks },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Attendance marked:', response.data);
      // Update UI with response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 400) {
          alert('Validation error: ' + error.response.data.message);
        } else if (error.response?.status === 404) {
          alert('Register not found');
        } else if (error.response?.status === 403) {
          alert('You do not have permission to mark attendance');
        }
      }
    }
  };

  const handleStatusChange = (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE') => {
    setMarks(prev => {
      const existing = prev.find(m => m.studentId === studentId);
      if (existing) {
        return prev.map(m => 
          m.studentId === studentId ? { ...m, status } : m
        );
      } else {
        return [...prev, { studentId, status }];
      }
    });
  };

  return (
    <div>
      {/* UI components here */}
      <button onClick={markAttendance}>Save Attendance</button>
    </div>
  );
}
```

### Vue 3 Example

```typescript
import { ref } from 'vue';
import axios from 'axios';

export default {
  setup() {
    const marks = ref<AttendanceMark[]>([]);
    const registerId = ref<string>('');

    const markAttendance = async () => {
      try {
        const { data } = await axios.post(
          `/attendance/student/registers/${registerId.value}/mark`,
          { marks: marks.value },
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        console.log('Success:', data);
      } catch (error) {
        console.error('Error marking attendance:', error);
      }
    };

    return { marks, registerId, markAttendance };
  }
}
```

## TypeScript Examples

### Type Definitions

```typescript
// Request types
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE'
}

export interface AttendanceMarkDto {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

export interface MarkStudentAttendanceDto {
  marks: AttendanceMarkDto[];
}

// Response types
export enum RegisterStatus {
  DRAFT = 'DRAFT',
  SAVED = 'SAVED'
}

export interface StudentInRegister {
  studentId: string;
  admissionId: string;
  firstName: string;
  lastName: string;
  status?: AttendanceStatus;
  remarks?: string | null;
  markedAt?: string | null;
}

export interface RegisterResponse {
  id: string;
  classId: string;
  className: string;
  attendanceDate: string;
  status: RegisterStatus;
  students: StudentInRegister[];
  createdAt: string;
  updatedAt: string;
}
```

### Service Class

```typescript
import axios, { AxiosInstance } from 'axios';

export class AttendanceService {
  private client: AxiosInstance;

  constructor(baseURL: string, token: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async markAttendance(
    registerId: string,
    marks: AttendanceMarkDto[]
  ): Promise<RegisterResponse> {
    const response = await this.client.post<RegisterResponse>(
      `/attendance/student/registers/${registerId}/mark`,
      { marks }
    );
    return response.data;
  }

  async correctAttendance(
    registerId: string,
    studentId: string,
    status: AttendanceStatus,
    remarks?: string
  ): Promise<RegisterResponse> {
    return this.markAttendance(registerId, [
      { studentId, status, remarks }
    ]);
  }

  async markMultipleCorrections(
    registerId: string,
    corrections: AttendanceMarkDto[]
  ): Promise<RegisterResponse> {
    return this.markAttendance(registerId, corrections);
  }
}

// Usage
const service = new AttendanceService('https://api.example.com', 'jwt-token');

// Mark attendance
await service.markAttendance('register-123', [
  { studentId: 'student-1', status: AttendanceStatus.PRESENT },
  { studentId: 'student-2', status: AttendanceStatus.ABSENT, remarks: 'Sick' }
]);

// Correct single student
await service.correctAttendance(
  'register-123',
  'student-2',
  AttendanceStatus.PRESENT,
  'Doctor note provided'
);
```

### React Hook

```typescript
import { useState, useCallback } from 'react';
import axios from 'axios';

export function useAttendanceMarking(registerId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markAttendance = useCallback(async (marks: AttendanceMarkDto[]) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post<RegisterResponse>(
        `/attendance/student/registers/${registerId}/mark`,
        { marks },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setLoading(false);
      return response.data;
    } catch (err) {
      setLoading(false);
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Failed to mark attendance');
      } else {
        setError('An unexpected error occurred');
      }
      throw err;
    }
  }, [registerId]);

  return { markAttendance, loading, error };
}

// Usage in component
function AttendanceForm() {
  const registerId = 'register-123';
  const { markAttendance, loading, error } = useAttendanceMarking(registerId);

  const handleSubmit = async (marks: AttendanceMarkDto[]) => {
    try {
      const result = await markAttendance(marks);
      console.log('Marked successfully:', result);
    } catch (err) {
      console.error('Failed to mark:', err);
    }
  };

  return (
    <div>
      {loading && <p>Saving...</p>}
      {error && <p className="error">{error}</p>}
      {/* Form UI */}
    </div>
  );
}
```

## Best Practices

### 1. Always Validate Before Submission

```typescript
function validateMarks(marks: AttendanceMarkDto[], roster: string[]): boolean {
  // Check all students are in roster
  for (const mark of marks) {
    if (!roster.includes(mark.studentId)) {
      alert(`Student ${mark.studentId} is not in the register`);
      return false;
    }
  }

  // Check valid status
  const validStatuses = ['PRESENT', 'ABSENT', 'LATE'];
  for (const mark of marks) {
    if (!validStatuses.includes(mark.status)) {
      alert(`Invalid status: ${mark.status}`);
      return false;
    }
  }

  return true;
}
```

### 2. Handle Optimistic Updates

```typescript
async function markWithOptimisticUpdate(
  marks: AttendanceMarkDto[],
  updateUI: (marks: AttendanceMarkDto[]) => void,
  revertUI: () => void
) {
  // Update UI immediately
  updateUI(marks);

  try {
    // Send to server
    await service.markAttendance(registerId, marks);
  } catch (error) {
    // Revert UI on error
    revertUI();
    throw error;
  }
}
```

### 3. Batch Corrections Efficiently

```typescript
// BAD: Multiple API calls
for (const correction of corrections) {
  await service.correctAttendance(registerId, correction.studentId, correction.status);
}

// GOOD: Single API call
await service.markAttendance(registerId, corrections);
```

### 4. Track Unsaved Changes

```typescript
function useUnsavedChanges() {
  const [hasUnsaved, setHasUnsaved] = useState(false);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsaved]);

  return { hasUnsaved, setHasUnsaved };
}
```

## Testing

### Jest Unit Test

```typescript
import { AttendanceService } from './attendance.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AttendanceService', () => {
  let service: AttendanceService;

  beforeEach(() => {
    service = new AttendanceService('http://localhost', 'test-token');
  });

  it('should mark attendance successfully', async () => {
    const mockResponse = {
      data: {
        id: 'register-123',
        status: 'SAVED',
        students: []
      }
    };

    mockedAxios.post.mockResolvedValue(mockResponse);

    const result = await service.markAttendance('register-123', [
      { studentId: 'student-1', status: AttendanceStatus.PRESENT }
    ]);

    expect(result.status).toBe('SAVED');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/attendance/student/registers/register-123/mark',
      { marks: [{ studentId: 'student-1', status: 'PRESENT' }] }
    );
  });
});
```

---

## Summary

The student attendance marking and correction API provides:

- ✅ Flexible marking workflow (all at once or incremental)
- ✅ Comprehensive correction support
- ✅ Full audit trail
- ✅ Frozen roster validation
- ✅ Robust error handling
- ✅ Type-safe TypeScript integration
- ✅ Frontend framework compatibility

For more information, see the main [README.md](./README.md) and [TASK_15_COMPLETION.md](./TASK_15_COMPLETION.md).
