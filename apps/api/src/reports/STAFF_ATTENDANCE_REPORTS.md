# Staff Attendance Reports API

This document describes the staff attendance reports endpoints implemented in Task 19.

## Endpoints

### 1. Get Monthly Staff Attendance Report

Generates a monthly attendance report for all staff members or filtered by department and category.

**Endpoint:** `GET /reports/attendance/staff/monthly`

**Authorization:** ADMINISTRATOR role or STAFF with VIEW_REPORTS permission

**Query Parameters:**
- `year` (required): Year in YYYY format (2000-2100)
- `month` (required): Month (1-12)
- `department` (optional): Filter by department name
- `category` (optional): Filter by category (TEACHING or NON_TEACHING)

**Example Request:**
```bash
curl -X GET 'http://localhost:3000/reports/attendance/staff/monthly?year=2024&month=11' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

**Example Request with Filters:**
```bash
curl -X GET 'http://localhost:3000/reports/attendance/staff/monthly?year=2024&month=11&department=Mathematics&category=TEACHING' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

**Response:**
```json
{
  "year": 2024,
  "month": 11,
  "department": null,
  "category": null,
  "generatedAt": "2024-11-20T10:30:00.000Z",
  "staff": [
    {
      "staffId": "STAFF001",
      "firstName": "Jane",
      "lastName": "Smith",
      "staffName": "Jane Smith",
      "email": "jane.smith@example.com",
      "designation": "Senior Teacher",
      "department": "Mathematics",
      "category": "TEACHING",
      "presentCount": 18,
      "lateCount": 2,
      "absentCount": 1,
      "percentage": 95.24,
      "totalMarked": 21
    },
    {
      "staffId": "STAFF002",
      "firstName": "John",
      "lastName": "Doe",
      "staffName": "John Doe",
      "email": "john.doe@example.com",
      "designation": "Administrator",
      "department": "Administration",
      "category": "NON_TEACHING",
      "presentCount": 20,
      "lateCount": 0,
      "absentCount": 1,
      "percentage": 95.24,
      "totalMarked": 21
    }
  ]
}
```

**Percentage Calculation:**
```
percentage = 100 × (presentCount + lateCount) / (presentCount + lateCount + absentCount)
```

If no attendance is marked (totalMarked = 0), percentage will be `null`.

**Response Codes:**
- `200 OK`: Report generated successfully
- `400 Bad Request`: Invalid month or year
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User lacks required permissions

---

### 2. Get Staff Attendance History

Retrieves attendance history for a specific staff member with optional date range filtering.

**Endpoint:** `GET /reports/attendance/staff/:staffId/history`

**Authorization:** ADMINISTRATOR role, or the staff member themselves

**Path Parameters:**
- `staffId`: UUID of the staff member

**Query Parameters:**
- `dateFrom` (optional): Start date in YYYY-MM-DD format
- `dateTo` (optional): End date in YYYY-MM-DD format

**Example Request:**
```bash
curl -X GET 'http://localhost:3000/reports/attendance/staff/abc-123-def-456/history' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

**Example Request with Date Range:**
```bash
curl -X GET 'http://localhost:3000/reports/attendance/staff/abc-123-def-456/history?dateFrom=2024-11-01&dateTo=2024-11-30' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

**Response:**
```json
[
  {
    "id": "att-uuid-1",
    "staffId": "abc-123-def-456",
    "attendanceDate": "2024-11-20",
    "status": "PRESENT",
    "remarks": null,
    "markedBy": "admin-user-id",
    "markedAt": "2024-11-20T09:00:00.000Z"
  },
  {
    "id": "att-uuid-2",
    "staffId": "abc-123-def-456",
    "attendanceDate": "2024-11-19",
    "status": "LATE",
    "remarks": "Traffic delay",
    "markedBy": "admin-user-id",
    "markedAt": "2024-11-19T09:30:00.000Z"
  }
]
```

**Attendance Status Values:**
- `PRESENT`: Staff member was present
- `ABSENT`: Staff member was absent
- `LATE`: Staff member arrived late

**Response Codes:**
- `200 OK`: History retrieved successfully
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Staff members can only view their own records
- `404 Not Found`: Staff member not found

---

## Authorization Rules

### Monthly Staff Attendance Report
- **ADMINISTRATOR**: Can generate reports for all staff with any filters
- **STAFF with VIEW_REPORTS permission**: Can generate reports for all staff with any filters
- **STAFF without VIEW_REPORTS permission**: Access denied (403 Forbidden)
- **STUDENT**: Access denied (403 Forbidden)

### Staff Attendance History
- **ADMINISTRATOR**: Can view any staff member's attendance history
- **STAFF**: Can only view their own attendance history
- **STUDENT**: Access denied (403 Forbidden)

---

## Business Rules

1. **Percentage Calculation**
   - Formula: `100 × (Present + Late) / (Present + Late + Absent)`
   - Late attendance counts as present for percentage calculation
   - Returns `null` when no attendance has been marked (denominator = 0)
   - Rounded to 2 decimal places

2. **Date Range**
   - Month boundaries are calculated using Asia/Kolkata timezone (as per institute settings)
   - Start date: First day of the month at 00:00:00
   - End date: Last day of the month at 23:59:59.999

3. **Filtering**
   - Department filter is case-sensitive exact match
   - Category filter accepts only: TEACHING or NON_TEACHING
   - Multiple filters can be combined (department AND category)

4. **Staff Visibility**
   - Only ACTIVE staff members are included in monthly reports
   - INACTIVE staff are excluded from reports
   - History endpoint works for any staff member (active or inactive)

5. **Data Isolation**
   - Staff members can only view their own attendance history
   - Attempting to view another staff member's history returns 403 Forbidden
   - Administrators bypass this restriction

---

## Use Cases

### Use Case 1: Generate Monthly Report for All Staff
An administrator wants to see the attendance summary for all staff members in November 2024.

**Request:**
```bash
GET /reports/attendance/staff/monthly?year=2024&month=11
```

**Result:** Returns attendance summary for all active staff members with counts and percentages.

---

### Use Case 2: Filter Report by Department
An administrator wants to see attendance for only the Mathematics department.

**Request:**
```bash
GET /reports/attendance/staff/monthly?year=2024&month=11&department=Mathematics
```

**Result:** Returns attendance summary filtered to Mathematics department only.

---

### Use Case 3: Filter Report by Category
An administrator wants to see attendance for only teaching staff.

**Request:**
```bash
GET /reports/attendance/staff/monthly?year=2024&month=11&category=TEACHING
```

**Result:** Returns attendance summary for teaching staff only.

---

### Use Case 4: Staff Member Views Own History
A staff member wants to view their attendance history for the current month.

**Request:**
```bash
GET /reports/attendance/staff/{their-staff-id}/history?dateFrom=2024-11-01&dateTo=2024-11-30
```

**Result:** Returns their attendance records for November 2024.

---

### Use Case 5: Administrator Reviews Specific Staff Member
An administrator wants to review a staff member's attendance history.

**Request:**
```bash
GET /reports/attendance/staff/{staff-id}/history?dateFrom=2024-10-01&dateTo=2024-10-31
```

**Result:** Returns the staff member's attendance records for October 2024.

---

## Integration with Existing Endpoints

These endpoints complement the existing staff attendance endpoints in the Attendance module:

- `POST /attendance/staff` - Mark staff attendance (Task 16)
- `GET /attendance/staff` - Get staff attendance records with filters (Task 16)
- `GET /attendance/staff/:staffId` - Get specific staff member's attendance (Task 16)

The reports endpoints provide:
- Aggregated monthly statistics (counts and percentages)
- Simplified filtering by department and category
- Consistent API structure with student attendance reports
- Export-ready data format for CSV generation

---

## Testing

### Manual Testing Scenarios

1. **Valid Monthly Report**
   ```bash
   GET /reports/attendance/staff/monthly?year=2024&month=11
   # Expected: 200 OK with staff list
   ```

2. **Invalid Month**
   ```bash
   GET /reports/attendance/staff/monthly?year=2024&month=13
   # Expected: 400 Bad Request
   ```

3. **Invalid Year**
   ```bash
   GET /reports/attendance/staff/monthly?year=1999&month=11
   # Expected: 400 Bad Request
   ```

4. **Department Filter**
   ```bash
   GET /reports/attendance/staff/monthly?year=2024&month=11&department=Mathematics
   # Expected: 200 OK with filtered staff list
   ```

5. **Category Filter**
   ```bash
   GET /reports/attendance/staff/monthly?year=2024&month=11&category=TEACHING
   # Expected: 200 OK with teaching staff only
   ```

6. **Staff Views Own History**
   ```bash
   GET /reports/attendance/staff/{own-staff-id}/history
   # Expected: 200 OK with own records
   ```

7. **Staff Views Another's History**
   ```bash
   GET /reports/attendance/staff/{other-staff-id}/history
   # Expected: 403 Forbidden
   ```

8. **Invalid Staff ID**
   ```bash
   GET /reports/attendance/staff/invalid-uuid/history
   # Expected: 404 Not Found
   ```

---

## Requirements Validation

This implementation validates **Requirement R14: Staff Attendance Reports**:

✅ Monthly staff reports display all staff members with attendance records
✅ Report shows staff name, staff ID, designation, department, present/late/absent counts, and percentage
✅ Percentage calculated as: 100 × (present + late) / (present + late + absent)
✅ "No marked entries" case handled with null percentage
✅ Filtering by department and staff category (teaching/non-teaching) supported
✅ CSV export ready (data format suitable for conversion)

Additional features beyond requirements:
- Staff attendance history endpoint with date range filtering
- Data isolation for staff members (can only view own records)
- Email address included in report output
- Total marked attendance count for quick reference
- Consistent error handling and validation
