# Task 14: Attendance Register Opening Logic - Implementation Summary

## Overview
This document summarizes the implementation of Task 14: Attendance Register Opening Logic for the TaxBros LMS system.

## Implementation Date
November 18, 2026

## Requirements Addressed
- **Requirement 7.1**: WHEN an authorized user opens a register for a class and date, THE System SHALL create a new register if none exists
- **Requirement 7.2**: WHEN an authorized user opens a register for a class and date, THE System SHALL retrieve the existing register if one exists
- **Requirement 7.3**: WHEN a register is created for the first time, THE System SHALL capture a frozen roster snapshot of all Students with ACTIVE enrollment in that class
- **Requirement 7.4**: THE System SHALL store the frozen roster as a JSON array of Student IDs with the register
- **Requirement 7.5**: WHEN a register is opened, THE System SHALL display all Students from the frozen roster with their current attendance status
- **Requirement 7.6**: THE System SHALL display unmarked entries as visibly incomplete in the register interface
- **Requirement 7.7**: WHEN later enrollment changes occur, THE System SHALL NOT modify the frozen roster of previously opened registers
- **Requirement 7.8**: THE System SHALL enforce unique register records per class and attendance date combination
- **Requirement 7.9**: WHEN an authorized user views an unopened date, THE System SHALL NOT generate attendance entries automatically
- **Requirement 7.10**: THE System SHALL set new register status to DRAFT until first save operation

## Files Created

### 1. DTOs (Data Transfer Objects)
- **`src/attendance/dto/open-register.dto.ts`**: Request DTO for opening registers
  - Validates `classId` (UUID)
  - Validates `attendanceDate` (ISO date string YYYY-MM-DD)
  
- **`src/attendance/dto/register-response.dto.ts`**: Response DTO for register data
  - Returns register information with class details
  - Includes student roster with attendance status
  - Shows marked/unmarked entries

- **`src/attendance/dto/index.ts`**: Index file for DTO exports

### 2. Service Layer
- **`src/attendance/attendance.service.ts`**: Core business logic
  - `openRegister()` method implements the register opening workflow
  - Validates class existence
  - Checks for existing registers
  - Creates new registers with frozen roster snapshot
  - Returns student details with attendance status

### 3. Controller Layer
- **`src/attendance/attendance.controller.ts`**: REST API endpoint
  - `POST /attendance/student/registers`: Opens or retrieves a register
  - Protected with JWT authentication
  - Restricted to ADMINISTRATOR and STAFF roles
  - Returns structured register response

### 4. Module Configuration
- **`src/attendance/attendance.module.ts`**: NestJS module definition
  - Imports PrismaModule for database access
  - Exports AttendanceService for reuse
  - Registers controller and service

### 5. Application Configuration
- **`src/app.module.ts`**: Updated to include AttendanceModule

### 6. Tests
- **`src/attendance/attendance.service.spec.ts`**: Unit tests for AttendanceService
  - Tests class validation
  - Tests date validation
  - Tests register creation with frozen roster
  - Tests existing register retrieval
  - Tests edge cases (no enrollments, deleted students)

## Key Features Implemented

### 1. Frozen Roster Snapshot
When a register is opened for the first time:
1. System queries all ACTIVE class enrollments
2. Extracts student IDs into an array
3. Stores the array as JSON in `rosterSnapshot` field
4. This snapshot is permanent and never modified

### 2. Register Uniqueness
- Unique constraint on `(classId, attendanceDate)` ensures one register per class per date
- Prevents duplicate register creation

### 3. Timezone Handling
- Accepts date in ISO format (YYYY-MM-DD)
- Converts to Date object for database storage
- Uses Asia/Kolkata timezone (as per institute settings)

### 4. Status Management
- New registers start with `DRAFT` status
- Status changes to `SAVED` when attendance is marked (Task 15)

### 5. Student Details Enrichment
- Fetches full student details for all IDs in frozen roster
- Handles deleted students gracefully (shows "Unknown" values)
- Includes attendance status if already marked

## API Endpoint

### POST /attendance/student/registers

**Request Body:**
```json
{
  "classId": "550e8400-e29b-41d4-a716-446655440000",
  "attendanceDate": "2024-11-18"
}
```

**Response (201 Created):**
```json
{
  "id": "register-id",
  "classId": "class-id",
  "className": "Batch 2024 Morning",
  "attendanceDate": "2024-11-18T00:00:00.000Z",
  "status": "DRAFT",
  "students": [
    {
      "studentId": "student-1",
      "admissionId": "STU001",
      "firstName": "John",
      "lastName": "Doe",
      "status": undefined,  // Unmarked
      "remarks": undefined,
      "markedAt": undefined
    },
    {
      "studentId": "student-2",
      "admissionId": "STU002",
      "firstName": "Jane",
      "lastName": "Smith",
      "status": "PRESENT",  // Already marked
      "remarks": null,
      "markedAt": "2024-11-18T10:30:00.000Z"
    }
  ],
  "createdAt": "2024-11-18T08:00:00.000Z",
  "updatedAt": "2024-11-18T10:30:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid date format
- `404 Not Found`: Class not found
- `403 Forbidden`: Insufficient permissions
- `401 Unauthorized`: Not authenticated

## Database Schema Used

The implementation relies on the existing Prisma schema:

```prisma
model StudentAttendanceRegister {
  id             String            @id @default(uuid())
  classId        String
  attendanceDate DateTime          @db.Date
  rosterSnapshot Json              // JSON array of student IDs
  status         RegisterStatus    @default(DRAFT)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  class              Class               @relation(fields: [classId], references: [id])
  attendanceRecords  StudentAttendance[]

  @@unique([classId, attendanceDate])
  @@index([classId, attendanceDate])
}
```

## Security & Authorization

### Authentication
- JWT-based authentication using `JwtAuthGuard`
- Validates bearer token in Authorization header

### Authorization
- Role-based access control using `RolesGuard`
- Only ADMINISTRATOR and STAFF roles can open registers
- Students cannot access this endpoint

### Permission Enforcement
The design includes MARK_ATTENDANCE permission for Staff users, which will be enforced in Task 15 (marking attendance).

## Testing Strategy

### Unit Tests
Comprehensive unit tests cover:
- ✅ Service initialization
- ✅ Class validation (404 when not found)
- ✅ Date validation (400 for invalid dates)
- ✅ New register creation with frozen roster
- ✅ Existing register retrieval
- ✅ Empty roster handling
- ✅ Deleted student handling
- ✅ Attendance status display

### Integration Points
The implementation integrates with:
- **PrismaService**: Database operations
- **AuthModule**: JWT authentication and role guards
- **ClassesModule**: Class validation

## Next Steps (Task 15)

Task 15 will implement:
1. Marking attendance endpoint (`POST /attendance/student/registers/:id/mark`)
2. Attendance status updates (PRESENT, ABSENT, LATE)
3. Register status change from DRAFT to SAVED
4. Attendance correction support
5. Marker tracking (markedBy, markedAt)

## Notes

1. **Frozen Roster Immutability**: Once a register is created, the roster snapshot never changes. This ensures historical accuracy even if students are later removed from the class.

2. **Graceful Degradation**: If a student in the frozen roster no longer exists (deleted), the system shows "Unknown" values instead of failing.

3. **Timezone Consistency**: All date handling respects the Asia/Kolkata timezone as per institute settings.

4. **Performance Consideration**: The implementation fetches student details separately after retrieving the register. For large classes, this could be optimized with a single JOIN query.

5. **Validation**: Both class existence and date format are validated before any database operations.

## Conclusion

Task 14 has been successfully implemented with:
- ✅ Complete service layer logic
- ✅ REST API endpoint
- ✅ DTOs for request/response
- ✅ Module configuration
- ✅ Unit tests
- ✅ Documentation

The implementation follows NestJS best practices, validates all requirements, and prepares the foundation for Task 15 (attendance marking).
