# Reports Module

## Overview

The Reports module provides attendance reporting and analytics functionality for the TAXBROS LMS. It handles monthly attendance calculations, historical data retrieval, and supports filtering by various criteria.

## Features

- Monthly student attendance reports with percentage calculations
- Student attendance history with filtering
- Support for date range and class-based filtering
- Role-based access control (students can only view their own data)
- Timezone-aware calculations (Asia/Kolkata)

## Endpoints

### 1. Get Monthly Student Attendance Report

**Endpoint:** `GET /api/reports/attendance/student/monthly`

**Authorization:** ADMINISTRATOR or STAFF role required

**Query Parameters:**
- `year` (required): Year in YYYY format (2000-2100)
- `month` (required): Month number (1-12)
- `classId` (optional): Filter by specific class UUID

**Response Example:**
```json
{
  "year": 2024,
  "month": 11,
  "classId": null,
  "generatedAt": "2024-11-18T17:30:00.000Z",
  "students": [
    {
      "studentId": "uuid-here",
      "admissionId": "ADM001",
      "firstName": "John",
      "lastName": "Doe",
      "studentName": "John Doe",
      "email": "john@example.com",
      "className": "Class A",
      "presentCount": 7,
      "lateCount": 1,
      "absentCount": 2,
      "unmarkedCount": 1,
      "percentage": 80.0,
      "totalMarked": 10
    }
  ]
}
```

**Percentage Calculation:**
- Formula: `100 × (presentCount + lateCount) / (presentCount + lateCount + absentCount)`
- Unmarked entries are excluded from the calculation
- Returns `null` if no marked entries exist

**Use Cases:**
- Generate monthly attendance reports for administrators
- Monitor student attendance compliance
- Export data for analysis or reporting
- Filter by specific class to view class-level attendance

### 2. Get Student Attendance History

**Endpoint:** `GET /api/reports/attendance/student/:studentId/history`

**Authorization:** 
- ADMINISTRATOR and STAFF can view any student's history
- STUDENT can only view their own history

**Path Parameters:**
- `studentId` (required): Student UUID

**Query Parameters:**
- `dateFrom` (optional): Start date in YYYY-MM-DD format
- `dateTo` (optional): End date in YYYY-MM-DD format
- `classId` (optional): Filter by specific class UUID
- `status` (optional): Filter by attendance status (PRESENT, ABSENT, LATE)

**Response Example:**
```json
[
  {
    "id": "attendance-uuid",
    "studentId": "student-uuid",
    "className": "Class A",
    "attendanceDate": "2024-11-15T00:00:00.000Z",
    "status": "PRESENT",
    "remarks": "On time",
    "markedBy": "teacher-user-id",
    "markedAt": "2024-11-15T09:05:00.000Z"
  }
]
```

**Use Cases:**
- Students review their own attendance records
- Teachers view individual student attendance patterns
- Administrators investigate attendance issues
- Filter by date range for specific periods

## Business Logic

### Monthly Attendance Calculation

The service implements the following calculation logic:

1. **Date Range Determination:**
   - Uses Asia/Kolkata timezone for month boundaries
   - Start: First day of month at 00:00:00
   - End: Last day of month at 23:59:59.999

2. **Attendance Aggregation:**
   - Queries all attendance records for the student in the date range
   - Groups by status (PRESENT, LATE, ABSENT, unmarked)
   - Counts each category separately

3. **Percentage Formula:**
   ```
   percentage = 100 × (present + late) / (present + late + absent)
   ```
   - Unmarked entries are excluded from denominator
   - Returns `null` when denominator is 0 (no marked entries)
   - Rounds to 2 decimal places

4. **Mid-Month Enrollment Handling:**
   - The calculation automatically includes only attendance records that exist
   - If a student enrolls mid-month, only records from enrollment date forward are counted
   - No special date filtering is needed as records don't exist before enrollment

### Data Isolation

The module enforces strict data isolation:

- **Students:** Can only access their own attendance records
- **Staff:** Can view all student records (with VIEW_REPORTS permission)
- **Administrators:** Can view all records without restrictions

The controller validates the requesting user's role and enforces ownership checks before returning data.

## Implementation Details

### Service Methods

#### `calculateMonthlyAttendance(studentId, year, month, classId?)`
Private helper method that calculates attendance statistics for a single student.

**Returns:**
```typescript
{
  presentCount: number;
  lateCount: number;
  absentCount: number;
  unmarkedCount: number;
  percentage: number | null;
}
```

#### `getMonthlyStudentAttendanceReport(query)`
Generates a comprehensive monthly report for all students or filtered by class.

**Validations:**
- Month must be 1-12
- Year must be 2000-2100
- Class ID must exist if provided

#### `getStudentAttendanceHistory(studentId, filters?)`
Retrieves historical attendance records with optional filtering.

**Features:**
- Date range filtering
- Class-based filtering
- Status-based filtering
- Ordered by marked date descending

## Error Handling

The module throws appropriate exceptions:

- `NotFoundException`: Invalid class ID, student not found, invalid month/year
- `UnauthorizedException`: Student attempting to view another student's records
- `BadRequestException`: Invalid date formats or parameters

## Testing

The module includes unit tests covering:

- Monthly report generation
- Attendance calculation accuracy
- Percentage formula validation
- Null percentage handling (no marked entries)
- Student data isolation
- Invalid input handling
- Date range filtering

Run tests with:
```bash
npm run test -- reports.service.spec.ts
```

## Integration

The module is registered in `AppModule` and depends on:

- `PrismaModule`: Database access
- `AuthModule`: JWT authentication (implicit via guards)

## API Documentation

Swagger documentation is available at `/api/docs` when the server is running. The endpoints include:

- Full parameter descriptions
- Example requests/responses
- Authorization requirements
- Status code documentation

## Future Enhancements

Planned features for future releases:

1. **Staff Attendance Reports:**
   - Monthly staff attendance reports
   - Department-wise filtering
   - Teaching vs non-teaching category filtering

2. **Export Functionality:**
   - CSV export for reports
   - PDF generation for formal reports
   - Excel export with formatting

3. **Advanced Analytics:**
   - Attendance trends over time
   - Class-level comparison
   - Predictive analytics for at-risk students

4. **Caching:**
   - Redis caching for frequently accessed reports
   - Cache invalidation on attendance updates

## Related Modules

- **AttendanceModule**: Source of attendance data
- **ClassesModule**: Class information for filtering
- **StudentsModule**: Student profile data
- **AuthModule**: Authentication and authorization
