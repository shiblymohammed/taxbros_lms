# Attendance Module - Quick Reference

## Endpoints

### Student Attendance

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/attendance/student/registers` | ADMIN, STAFF | Open or retrieve register |
| POST | `/attendance/student/registers/:id/mark` | ADMIN, STAFF | Mark/correct attendance |

### Staff Attendance

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/attendance/staff` | ADMIN, STAFF | Mark staff attendance |
| GET | `/attendance/staff` | ADMIN | Get all staff attendance |
| GET | `/attendance/staff/:staffId` | ADMIN, STAFF | Get staff member attendance |

## Request Examples

### Open Register
```bash
POST /attendance/student/registers
{
  "classId": "uuid",
  "attendanceDate": "2024-11-18"
}
```

### Mark Attendance
```bash
POST /attendance/student/registers/{registerId}/mark
{
  "marks": [
    {
      "studentId": "uuid",
      "status": "PRESENT" | "ABSENT" | "LATE",
      "remarks": "optional text"
    }
  ]
}
```

### Mark Staff Attendance
```bash
POST /attendance/staff
{
  "staffId": "uuid",
  "attendanceDate": "2024-11-18",
  "status": "PRESENT" | "ABSENT" | "LATE",
  "remarks": "optional text"
}
```

## Status Values

| Value | Description |
|-------|-------------|
| `PRESENT` | Student/staff was present |
| `ABSENT` | Student/staff was absent |
| `LATE` | Student/staff arrived late |

## Register Status

| Value | Description |
|-------|-------------|
| `DRAFT` | Register opened, no marks saved |
| `SAVED` | At least one mark has been saved |

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success (marking) |
| 201 | Created (register opened) |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found (register/class not found) |

## TypeScript Types

```typescript
enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE'
}

interface AttendanceMarkDto {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

interface MarkStudentAttendanceDto {
  marks: AttendanceMarkDto[];
}
```

## Common Workflows

### 1. First-Time Marking
```
1. POST /attendance/student/registers (open)
2. POST /attendance/student/registers/:id/mark (mark all)
```

### 2. Correction
```
1. POST /attendance/student/registers (retrieve existing)
2. POST /attendance/student/registers/:id/mark (correct specific students)
```

### 3. Incremental Marking
```
1. POST /attendance/student/registers (open)
2. POST /attendance/student/registers/:id/mark (mark some students)
3. POST /attendance/student/registers/:id/mark (mark more students later)
```

## Key Features

- ✅ Frozen roster (snapshot at creation)
- ✅ Upsert logic (prevents duplicates)
- ✅ Audit trail (markedBy, markedAt)
- ✅ Partial marking support
- ✅ Correction support
- ✅ Role-based access control

## Documentation

- **README.md** - Full module documentation
- **TASK_15_COMPLETION.md** - Implementation details
- **MARKING_USAGE_EXAMPLES.md** - Comprehensive examples
- **TASK_15_SUMMARY.md** - Task completion summary

## Testing

```bash
# Run all attendance tests
npm test -- attendance

# Run specific test file
npm test -- attendance.service.spec.ts

# Run with coverage
npm test -- --coverage attendance
```

## Notes

- Register roster is frozen at creation time
- Students enrolled after register creation cannot be marked
- Same endpoint used for both marking and corrections
- Register status automatically changes from DRAFT to SAVED
- Corrections update audit trail with new markedBy/markedAt

## Support

For detailed information, see the full documentation files in this directory.
