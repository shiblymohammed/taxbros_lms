# Attendance Module - Usage Examples

## Opening an Attendance Register

### Example 1: Opening a Register for the First Time

**Request:**
```bash
curl -X POST http://localhost:3000/attendance/student/registers \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": "550e8400-e29b-41d4-a716-446655440000",
    "attendanceDate": "2024-11-18"
  }'
```

**Response (201 Created):**
```json
{
  "id": "register-abc-123",
  "classId": "550e8400-e29b-41d4-a716-446655440000",
  "className": "Batch 2024 Morning",
  "attendanceDate": "2024-11-18T00:00:00.000Z",
  "status": "DRAFT",
  "students": [
    {
      "studentId": "student-1",
      "admissionId": "STU001",
      "firstName": "John",
      "lastName": "Doe"
    },
    {
      "studentId": "student-2",
      "admissionId": "STU002",
      "firstName": "Jane",
      "lastName": "Smith"
    },
    {
      "studentId": "student-3",
      "admissionId": "STU003",
      "firstName": "Bob",
      "lastName": "Johnson"
    }
  ],
  "createdAt": "2024-11-18T08:00:00.000Z",
  "updatedAt": "2024-11-18T08:00:00.000Z"
}
```

**What happened:**
1. System checked if a register already exists for this class and date
2. None found, so created a new register
3. Queried all ACTIVE students enrolled in the class
4. Captured their IDs as a frozen roster snapshot: `["student-1", "student-2", "student-3"]`
5. Set register status to DRAFT
6. Returned the register with full student details
7. Notice: No students have attendance status yet (all unmarked)

---

### Example 2: Opening an Existing Register

**Request:**
```bash
curl -X POST http://localhost:3000/attendance/student/registers \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": "550e8400-e29b-41d4-a716-446655440000",
    "attendanceDate": "2024-11-18"
  }'
```

**Response (201 Created):**
```json
{
  "id": "register-abc-123",
  "classId": "550e8400-e29b-41d4-a716-446655440000",
  "className": "Batch 2024 Morning",
  "attendanceDate": "2024-11-18T00:00:00.000Z",
  "status": "SAVED",
  "students": [
    {
      "studentId": "student-1",
      "admissionId": "STU001",
      "firstName": "John",
      "lastName": "Doe",
      "status": "PRESENT",
      "remarks": null,
      "markedAt": "2024-11-18T10:30:00.000Z"
    },
    {
      "studentId": "student-2",
      "admissionId": "STU002",
      "firstName": "Jane",
      "lastName": "Smith",
      "status": "ABSENT",
      "remarks": "Sick leave",
      "markedAt": "2024-11-18T10:30:00.000Z"
    },
    {
      "studentId": "student-3",
      "admissionId": "STU003",
      "firstName": "Bob",
      "lastName": "Johnson"
    }
  ],
  "createdAt": "2024-11-18T08:00:00.000Z",
  "updatedAt": "2024-11-18T10:30:00.000Z"
}
```

**What happened:**
1. System found an existing register for this class and date
2. Retrieved the register with its frozen roster
3. Fetched student details for all IDs in the roster
4. Included attendance records that have been marked
5. Notice: 
   - Student 1 marked PRESENT
   - Student 2 marked ABSENT with remarks
   - Student 3 still unmarked
   - Register status is SAVED (attendance has been marked)

---

### Example 3: Error - Class Not Found

**Request:**
```bash
curl -X POST http://localhost:3000/attendance/student/registers \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": "non-existent-class-id",
    "attendanceDate": "2024-11-18"
  }'
```

**Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Class with ID non-existent-class-id not found",
  "error": "Not Found"
}
```

---

### Example 4: Error - Invalid Date Format

**Request:**
```bash
curl -X POST http://localhost:3000/attendance/student/registers \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": "550e8400-e29b-41d4-a716-446655440000",
    "attendanceDate": "18-11-2024"
  }'
```

**Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Invalid date format. Expected YYYY-MM-DD",
  "error": "Bad Request"
}
```

---

### Example 5: Error - Insufficient Permissions

**Request from a STUDENT user:**
```bash
curl -X POST http://localhost:3000/attendance/student/registers \
  -H "Authorization: Bearer <student-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": "550e8400-e29b-41d4-a716-446655440000",
    "attendanceDate": "2024-11-18"
  }'
```

**Response (403 Forbidden):**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

---

## Frozen Roster Behavior

### Scenario: Student Enrolled After Register Creation

**Timeline:**
1. **Day 1 (Nov 18, 8:00 AM)**: Register opened with 3 students
   - Frozen roster: `["student-1", "student-2", "student-3"]`

2. **Day 1 (Nov 18, 11:00 AM)**: New student enrolled in class
   - Class now has 4 active students
   - But register roster remains unchanged

3. **Day 1 (Nov 18, 2:00 PM)**: Register reopened
   - Still shows only 3 students (from frozen roster)
   - New student NOT included

**Why?** The frozen roster ensures historical accuracy. Once a register is created, the roster snapshot never changes, even if students are added or removed from the class later.

---

### Scenario: Student Removed After Register Creation

**Timeline:**
1. **Day 1 (Nov 18, 8:00 AM)**: Register opened with 3 students
   - Frozen roster: `["student-1", "student-2", "student-3"]`

2. **Day 1 (Nov 18, 11:00 AM)**: Student-3 removed from class
   - Class now has 2 active students
   - But register roster remains unchanged

3. **Day 1 (Nov 18, 2:00 PM)**: Register reopened
   - Still shows all 3 students (from frozen roster)
   - Student-3 still appears in the list

**Why?** The frozen roster preserves the attendance record for students who were present at the time the register was opened, even if they're later removed from the class.

---

## Next Steps

After opening a register, you can:
1. **Mark attendance** using the register ID (Task 15)
2. **View attendance history** by student or class (Task 20)
3. **Generate monthly reports** (Task 17-19)

## Integration with Frontend

### React/Next.js Example

```typescript
import axios from 'axios';

interface OpenRegisterDto {
  classId: string;
  attendanceDate: string;
}

async function openRegister(classId: string, date: string, token: string) {
  try {
    const response = await axios.post(
      'http://localhost:3000/attendance/student/registers',
      {
        classId,
        attendanceDate: date,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Register opened:', response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error:', error.response?.data);
      throw error.response?.data;
    }
    throw error;
  }
}

// Usage
const classId = '550e8400-e29b-41d4-a716-446655440000';
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
const token = localStorage.getItem('accessToken');

openRegister(classId, today, token)
  .then(register => {
    console.log(`Opened register for ${register.className}`);
    console.log(`Total students: ${register.students.length}`);
    console.log(`Status: ${register.status}`);
  })
  .catch(err => {
    console.error('Failed to open register:', err);
  });
```

---

## TypeScript Types

```typescript
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
}

export enum RegisterStatus {
  DRAFT = 'DRAFT',
  SAVED = 'SAVED',
}

export interface StudentInRegister {
  studentId: string;
  admissionId: string;
  firstName: string;
  lastName: string;
  status?: AttendanceStatus;
  remarks?: string;
  markedAt?: Date;
}

export interface AttendanceRegister {
  id: string;
  classId: string;
  className: string;
  attendanceDate: Date;
  status: RegisterStatus;
  students: StudentInRegister[];
  createdAt: Date;
  updatedAt: Date;
}
```
