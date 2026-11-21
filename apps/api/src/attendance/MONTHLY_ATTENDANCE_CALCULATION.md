# Monthly Attendance Calculation Service

## Overview

The Monthly Attendance Calculation Service provides functionality to calculate attendance statistics for students and staff members on a monthly basis. It implements the formula specified in the requirements:

**Percentage = 100 × (Present + Late) / (Present + Late + Absent)**

Unmarked entries are **excluded** from the percentage calculation.

## Service: AttendanceCalculationService

### Location
`src/attendance/attendance-calculation.service.ts`

### Methods

#### 1. calculateMonthlyStudentAttendance

Calculates monthly attendance for all students, optionally filtered by class.

**Signature:**
```typescript
async calculateMonthlyStudentAttendance(
  year: number,
  month: number,
  classId?: string,
): Promise<MonthlyAttendanceStats[]>
```

**Parameters:**
- `year`: Year (YYYY format, e.g., 2024)
- `month`: Month (1-12)
- `classId`: Optional class filter

**Returns:**
Array of `MonthlyAttendanceStats` containing:
- `id`: Student ID
- `name`: Full name (firstName + lastName)
- `identifierId`: Admission ID
- `presentCount`: Number of PRESENT marks
- `lateCount`: Number of LATE marks
- `absentCount`: Number of ABSENT marks
- `unmarkedCount`: Number of dates where student was in roster but not marked
- `percentage`: Calculated attendance percentage (null if no marked entries)
- `className`: Name of the class

**Example:**
```typescript
const stats = await calculationService.calculateMonthlyStudentAttendance(
  2024,
  1,
  'class-id-123'
);

// Returns:
[
  {
    id: 'student-1',
    name: 'John Doe',
    identifierId: 'ADM001',
    presentCount: 18,
    lateCount: 2,
    absentCount: 3,
    unmarkedCount: 0,
    percentage: 87, // (18 + 2) / (18 + 2 + 3) * 100 = 86.96 rounded to 87
    className: 'Class 10A'
  }
]
```

#### 2. calculateStudentMonthlyStats

Calculates monthly attendance for a specific student.

**Signature:**
```typescript
async calculateStudentMonthlyStats(
  studentId: string,
  year: number,
  month: number,
  classId?: string,
): Promise<MonthlyAttendanceStats | null>
```

**Parameters:**
- `studentId`: Student ID
- `year`: Year (YYYY)
- `month`: Month (1-12)
- `classId`: Optional class filter

**Returns:**
Single `MonthlyAttendanceStats` object or null if student not found.

#### 3. calculateMonthlyStaffAttendance

Calculates monthly attendance for all staff, with optional filters.

**Signature:**
```typescript
async calculateMonthlyStaffAttendance(
  year: number,
  month: number,
  department?: string,
  category?: string,
): Promise<MonthlyAttendanceStats[]>
```

**Parameters:**
- `year`: Year (YYYY)
- `month`: Month (1-12)
- `department`: Optional department filter
- `category`: Optional category filter ('TEACHING' or 'NON_TEACHING')

**Returns:**
Array of `MonthlyAttendanceStats` containing:
- `id`: Staff ID
- `name`: Full name (firstName + lastName)
- `identifierId`: Staff ID
- `presentCount`: Number of PRESENT marks
- `lateCount`: Number of LATE marks
- `absentCount`: Number of ABSENT marks
- `unmarkedCount`: Number of days in month without attendance record
- `percentage`: Calculated attendance percentage (null if no marked entries)
- `designation`: Staff designation
- `department`: Staff department

**Example:**
```typescript
const stats = await calculationService.calculateMonthlyStaffAttendance(
  2024,
  1,
  'Mathematics',
  'TEACHING'
);

// Returns:
[
  {
    id: 'staff-1',
    name: 'Jane Smith',
    identifierId: 'STF001',
    presentCount: 20,
    lateCount: 1,
    absentCount: 2,
    unmarkedCount: 8,
    percentage: 91, // (20 + 1) / (20 + 1 + 2) * 100 = 91.3 rounded to 91
    designation: 'Senior Teacher',
    department: 'Mathematics'
  }
]
```

#### 4. calculateStaffMonthlyStats

Calculates monthly attendance for a specific staff member.

**Signature:**
```typescript
async calculateStaffMonthlyStats(
  staffId: string,
  year: number,
  month: number,
): Promise<MonthlyAttendanceStats | null>
```

**Parameters:**
- `staffId`: Staff ID
- `year`: Year (YYYY)
- `month`: Month (1-12)

**Returns:**
Single `MonthlyAttendanceStats` object or null if staff member not found.

## API Endpoints

### GET /attendance/reports/student/monthly

Generates monthly student attendance report.

**Authorization:** Administrator or Staff role required

**Query Parameters:**
- `year` (required): Year in YYYY format
- `month` (required): Month (1-12)
- `classId` (optional): Filter by specific class

**Response:**
```json
[
  {
    "id": "student-id-1",
    "name": "John Doe",
    "identifierId": "ADM001",
    "presentCount": 18,
    "lateCount": 2,
    "absentCount": 3,
    "unmarkedCount": 0,
    "percentage": 87,
    "className": "Class 10A"
  }
]
```

**Example Request:**
```bash
GET /attendance/reports/student/monthly?year=2024&month=1&classId=class-123
Authorization: Bearer <jwt-token>
```

### GET /attendance/reports/staff/monthly

Generates monthly staff attendance report.

**Authorization:** Administrator role required

**Query Parameters:**
- `year` (required): Year in YYYY format
- `month` (required): Month (1-12)
- `department` (optional): Filter by department
- `category` (optional): Filter by category (TEACHING or NON_TEACHING)

**Response:**
```json
[
  {
    "id": "staff-id-1",
    "name": "Jane Smith",
    "identifierId": "STF001",
    "presentCount": 20,
    "lateCount": 1,
    "absentCount": 2,
    "unmarkedCount": 8,
    "percentage": 91,
    "designation": "Senior Teacher",
    "department": "Mathematics"
  }
]
```

**Example Request:**
```bash
GET /attendance/reports/staff/monthly?year=2024&month=1&department=Mathematics
Authorization: Bearer <jwt-token>
```

## Calculation Logic

### Student Attendance

1. **Data Collection:**
   - Queries all `StudentAttendanceRegister` records for the specified month
   - Applies class filter if provided
   - Iterates through each register's frozen roster

2. **Aggregation:**
   - Groups attendance records by student
   - Counts PRESENT, LATE, ABSENT statuses
   - Tracks unmarked dates (student in roster but no attendance record)

3. **Percentage Calculation:**
   - Formula: `100 × (present + late) / (present + late + absent)`
   - Rounds to nearest integer
   - Returns `null` if denominator is zero (no marked entries)

4. **Mid-Month Enrollments:**
   - Only includes attendance from enrollment date forward
   - Automatically handled by frozen roster mechanism

### Staff Attendance

1. **Data Collection:**
   - Queries all staff members with ACTIVE status
   - Applies department and category filters if provided
   - Retrieves attendance records for the specified month

2. **Aggregation:**
   - Counts PRESENT, LATE, ABSENT statuses per staff member
   - Calculates unmarked days: `total_days_in_month - marked_count`

3. **Percentage Calculation:**
   - Same formula as student attendance
   - Returns `null` if no marked entries

## Edge Cases

### No Marked Entries

When a student or staff member has no marked attendance (all unmarked):
```json
{
  "presentCount": 0,
  "lateCount": 0,
  "absentCount": 0,
  "unmarkedCount": 23,
  "percentage": null
}
```

### All Present

When all attendance is marked as PRESENT:
```json
{
  "presentCount": 23,
  "lateCount": 0,
  "absentCount": 0,
  "unmarkedCount": 0,
  "percentage": 100
}
```

### Mixed Attendance with Unmarked

Example: 7 PRESENT, 1 LATE, 2 ABSENT, 1 UNMARKED
- Denominator: 7 + 1 + 2 = 10 (excludes unmarked)
- Numerator: 7 + 1 = 8
- Percentage: 100 × 8 / 10 = 80%

### Attendance Correction

When attendance is corrected (e.g., ABSENT changed to PRESENT):
- The recalculation automatically uses the updated status
- Percentage reflects the corrected data
- No special handling needed

## Testing

Unit tests are provided in `attendance-calculation.service.spec.ts`:

- ✓ Calculates percentage correctly
- ✓ Handles unmarked entries
- ✓ Returns null percentage when no marked entries
- ✓ Filters by department and category
- ✓ Handles multiple students in same class

To run tests:
```bash
npm test -- attendance-calculation.service.spec.ts
```

## Integration with Existing Modules

The calculation service is:
- Exported from `AttendanceModule`
- Injected into `AttendanceController`
- Available for use in reporting and dashboard features

**Module Registration:**
```typescript
@Module({
  imports: [PrismaModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceCalculationService],
  exports: [AttendanceService, AttendanceCalculationService],
})
export class AttendanceModule {}
```

## Requirements Validation

This implementation validates the following requirements:

- **R11**: Monthly Student Attendance Calculation
  - ✓ Calculates percentage using specified formula
  - ✓ Excludes unmarked entries from denominator
  - ✓ Returns null when no marked entries
  - ✓ Displays separate late count
  - ✓ Handles mid-month enrollments
  - ✓ Uses institute timezone (Asia/Kolkata)

- **R14**: Staff Attendance Reports
  - ✓ Generates monthly staff reports
  - ✓ Displays counts and percentage
  - ✓ Supports department and category filters
  - ✓ Shows "No marked entries" (via null percentage)

## Future Enhancements

Potential improvements for future iterations:

1. **Caching:** Cache monthly calculations to improve performance
2. **Export:** Add CSV export functionality
3. **Working Days:** Consider only working days in unmarked count
4. **Holidays:** Exclude institute holidays from calculations
5. **Notifications:** Alert administrators when attendance falls below threshold
6. **Trends:** Track attendance trends over multiple months
7. **Batch Calculation:** Calculate multiple months in parallel

## Related Files

- `attendance.service.ts` - Main attendance marking service
- `attendance.controller.ts` - REST API endpoints
- `attendance.module.ts` - Module configuration
- `dto/get-monthly-attendance.dto.ts` - Query parameter validation
- `attendance-calculation.service.spec.ts` - Unit tests
