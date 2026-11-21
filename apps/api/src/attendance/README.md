# Attendance Module

## Overview

The Attendance Module implements student and staff attendance tracking for the TaxBros LMS system. This module handles opening attendance registers, marking attendance, corrections, and reporting.

## Current Status

✅ **Task 14 Complete**: Attendance Register Opening Logic
- Register creation with frozen roster snapshot
- Existing register retrieval
- API endpoint implementation
- Full unit test coverage

✅ **Task 15 Complete**: Attendance Marking and Correction
- Mark student attendance (PRESENT, ABSENT, LATE)
- Support for corrections via upsert
- Register status transition (DRAFT → SAVED)
- Audit trail (markedBy, markedAt)
- Frozen roster validation
- Full unit test coverage

✅ **Task 16 Complete**: Staff Attendance Marking
- Mark staff attendance with same workflow
- Upsert for corrections
- Full unit test coverage

⏳ **Task 17-20 Pending**: Reports and History

## Module Structure

```
attendance/
├── dto/
│   ├── index.ts                    # DTO exports
│   ├── open-register.dto.ts       # Request DTO for opening registers
│   └── register-response.dto.ts   # Response DTO for register data
├── attendance.controller.ts        # REST API endpoints
├── attendance.service.ts           # Business logic
├── attendance.service.spec.ts      # Unit tests
├── attendance.module.ts            # NestJS module definition
├── index.ts                        # Module exports
├── README.md                       # This file
├── TASK_14_IMPLEMENTATION.md      # Implementation details
└── USAGE_EXAMPLES.md              # API usage examples
```

## Features

### Implemented

#### 1. Register Opening (Task 14)
- **POST /attendance/student/registers**: Opens or retrieves attendance register
- Creates new register if none exists for class/date combination
- Retrieves existing register if already created
- Captures frozen roster snapshot on creation
- Returns student list with attendance status

#### 2. Student Attendance Marking (Task 15)
- **POST /attendance/student/registers/:id/mark**: Marks or corrects student attendance
- Accepts array of student marks with status and optional remarks
- Validates students are in frozen roster
- Upserts attendance records (prevents duplicates)
- Updates register status from DRAFT to SAVED
- Supports corrections via same endpoint
- Records audit trail (markedBy, markedAt)
- Allows partial marking

#### 3. Staff Attendance Marking (Task 16)
- **POST /attendance/staff**: Marks or corrects staff attendance
- Upserts based on (staffId, attendanceDate) unique constraint
- Similar workflow to student attendance
- Full audit trail support

#### 4. Frozen Roster Snapshot
- Captures all ACTIVE students at register creation time
- Stores student IDs as JSON array
- Roster never changes after creation
- Preserves historical accuracy

#### 5. Validation
- Class existence validation
- Date format validation (YYYY-MM-DD)
- Unique constraint enforcement
- Status enum validation (PRESENT, ABSENT, LATE)
- Student roster validation

#### 6. Authorization
- JWT authentication required
- Role-based access (ADMINISTRATOR, STAFF only)
- Students cannot open or mark registers

### Pending Features

#### Task 17-19: Reports
- Monthly attendance calculation
- Student attendance reports
- Staff attendance reports

#### Task 20: History & Filtering
- View attendance history
- Filter by student, class, date range, status

## API Documentation

### Open Attendance Register

**Endpoint:** `POST /attendance/student/registers`

**Authorization:** Bearer token (ADMINISTRATOR or STAFF role)

**Request Body:**
```json
{
  "classId": "uuid",
  "attendanceDate": "YYYY-MM-DD"
}
```

**Success Response (201 Created):**
```json
{
  "id": "register-id",
  "classId": "class-id",
  "className": "Batch 2024 Morning",
  "attendanceDate": "2024-11-18T00:00:00.000Z",
  "status": "DRAFT",
  "students": [
    {
      "studentId": "student-id",
      "admissionId": "STU001",
      "firstName": "John",
      "lastName": "Doe",
      "status": "PRESENT",       // Optional, if already marked
      "remarks": "On time",      // Optional
      "markedAt": "2024-11-18T10:30:00.000Z"  // Optional
    }
  ],
  "createdAt": "2024-11-18T08:00:00.000Z",
  "updatedAt": "2024-11-18T10:30:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid date format
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Class not found

### Mark Student Attendance

**Endpoint:** `POST /attendance/student/registers/:id/mark`

**Authorization:** Bearer token (ADMINISTRATOR or STAFF role)

**Path Parameters:**
- `id` (string, required): UUID of the attendance register

**Request Body:**
```json
{
  "marks": [
    {
      "studentId": "uuid",
      "status": "PRESENT" | "ABSENT" | "LATE",
      "remarks": "Optional text"  // Optional
    }
  ]
}
```

**Success Response (200 OK):**
```json
{
  "id": "register-id",
  "classId": "class-id",
  "className": "Batch 2024 Morning",
  "attendanceDate": "2024-11-18T00:00:00.000Z",
  "status": "SAVED",  // Changed from DRAFT to SAVED
  "students": [
    {
      "studentId": "student-id",
      "admissionId": "STU001",
      "firstName": "John",
      "lastName": "Doe",
      "status": "PRESENT",
      "remarks": "On time",
      "markedAt": "2024-11-18T10:30:00.000Z"
    }
  ],
  "createdAt": "2024-11-18T08:00:00.000Z",
  "updatedAt": "2024-11-18T10:30:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Student not in register roster
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Register not found

## Database Schema

### StudentAttendanceRegister

```prisma
model StudentAttendanceRegister {
  id             String            @id @default(uuid())
  classId        String
  attendanceDate DateTime          @db.Date
  rosterSnapshot Json              // JSON array of student IDs
  status         RegisterStatus    @default(DRAFT)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  class              Class               @relation(...)
  attendanceRecords  StudentAttendance[]

  @@unique([classId, attendanceDate])
  @@index([classId, attendanceDate])
}
```

### StudentAttendance

```prisma
model StudentAttendance {
  id         String           @id @default(uuid())
  registerId String
  studentId  String
  status     AttendanceStatus // PRESENT, ABSENT, LATE
  remarks    String?
  markedBy   String
  markedAt   DateTime         @default(now())
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  register StudentAttendanceRegister @relation(...)
  student  Student                   @relation(...)

  @@unique([registerId, studentId])
  @@index([registerId])
  @@index([studentId])
}
```

## Testing

### Running Tests

```bash
# Run all attendance tests
npm test -- attendance

# Run specific test file
npm test -- attendance.service.spec.ts

# Run with coverage
npm test -- --coverage attendance
```

### Test Coverage

- ✅ Service initialization
- ✅ Class validation
- ✅ Date validation
- ✅ Register creation with frozen roster
- ✅ Existing register retrieval
- ✅ Empty roster handling
- ✅ Deleted student handling
- ✅ Attendance status display

## Usage Examples

See [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) for detailed API usage examples including:
- Opening register for first time
- Reopening existing register
- Error handling
- Frontend integration
- TypeScript types

## Implementation Details

See [TASK_14_IMPLEMENTATION.md](./TASK_14_IMPLEMENTATION.md) for:
- Requirements mapping
- Technical decisions
- Architecture details
- Security considerations
- Performance notes

## Dependencies

### Internal
- `PrismaModule`: Database operations
- `AuthModule`: JWT authentication, role guards

### External
- `@nestjs/common`: NestJS framework
- `@nestjs/swagger`: API documentation
- `class-validator`: DTO validation
- `prisma`: Database client

## Architecture Decisions

### 1. Frozen Roster Approach
**Decision:** Store student IDs as JSON array at register creation time

**Rationale:**
- Ensures historical accuracy
- Prevents changes from affecting past records
- Simple implementation
- Supports reporting on enrolled vs actual students

### 2. Register Status
**Decision:** Use DRAFT and SAVED statuses

**Rationale:**
- DRAFT: Register opened but no attendance marked
- SAVED: At least one attendance marked
- Allows differentiating complete vs incomplete registers

### 3. Date Handling
**Decision:** Accept ISO date strings (YYYY-MM-DD)

**Rationale:**
- Standard format
- Easy to validate
- Frontend-friendly
- Supports Asia/Kolkata timezone conversion

### 4. Student Details Fetching
**Decision:** Fetch student details separately after register retrieval

**Rationale:**
- Simpler query logic
- Handles deleted students gracefully
- Allows enrichment with additional data
- Future optimization possible with JOIN

## Security Considerations

### Authentication
- All endpoints require JWT bearer token
- Token validated via JwtAuthGuard
- Invalid/expired tokens return 401

### Authorization
- Role-based access control via RolesGuard
- Only ADMINISTRATOR and STAFF can open registers
- Students blocked at guard level (403)

### Data Validation
- DTO validation via class-validator
- UUID format validation for classId
- Date format validation
- Prevents injection attacks

### Business Logic Protection
- Class existence check before operations
- Unique constraint prevents duplicate registers
- Frozen roster immutability enforced

## Performance Considerations

### Current Implementation
- Separate queries for register and student details
- Acceptable for classes up to ~100 students
- Additional query per student in roster

### Future Optimizations
1. **JOIN Query**: Fetch register with student details in single query
2. **Caching**: Cache class and student data
3. **Pagination**: For very large classes
4. **Indexes**: Already optimized with composite indexes

## Error Handling

### Service Layer
- Throws `NotFoundException` for invalid class
- Throws `BadRequestException` for invalid date
- Prisma errors propagate to controller

### Controller Layer
- NestJS exception filter handles formatting
- Returns standard HTTP status codes
- Includes error message in response

## Next Steps

1. **Task 15**: Implement attendance marking
   - Add marking endpoint
   - Update register status
   - Track marker and timestamp

2. **Task 16**: Implement staff attendance
   - Similar workflow for staff
   - Reuse patterns from student attendance

3. **Task 17-19**: Implement reporting
   - Monthly calculation service
   - Report generation endpoints
   - CSV export

4. **Task 20**: Implement history
   - Filtering by various criteria
   - Student-specific views
   - Date range queries

## Contributing

When adding new features to this module:

1. **DTOs**: Add request/response DTOs in `dto/` folder
2. **Service**: Implement business logic in service layer
3. **Controller**: Add API endpoints in controller
4. **Tests**: Write unit tests for all new logic
5. **Documentation**: Update this README and add usage examples
6. **Validation**: Use class-validator decorators
7. **Authorization**: Apply appropriate guards

## Support

For questions or issues:
- Check [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) for API examples
- Check [TASK_14_IMPLEMENTATION.md](./TASK_14_IMPLEMENTATION.md) for implementation details
- Review unit tests for expected behavior
- Consult the main requirements document

## Version History

- **v1.2.0** (Nov 18, 2026): Task 15 completed - Attendance marking and correction
  - Student attendance marking endpoint
  - Upsert logic for corrections
  - Register status transition
  - Audit trail implementation
  - Comprehensive unit tests
  - Documentation updates

- **v1.1.0** (Nov 18, 2026): Task 16 completed - Staff attendance marking
  - Staff attendance endpoint
  - Similar upsert workflow
  - Full test coverage

- **v1.0.0** (Nov 18, 2026): Task 14 completed - Register opening logic
  - Initial implementation
  - Frozen roster snapshot
  - API endpoint
  - Unit tests
  - Documentation
