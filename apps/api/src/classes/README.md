# Classes Module

The Classes Module provides comprehensive class management functionality for the TAXBROS LMS, implementing **Requirement R4: Class Management**.

## Features

- ✅ Create classes with unique name validation
- ✅ List classes with status filtering (ACTIVE, ARCHIVED)
- ✅ Get class details with active enrollments only
- ✅ Update class information and archive classes
- ✅ Enroll students in classes with duplicate prevention
- ✅ Unenroll students with soft delete (INACTIVE status)
- ✅ Support multiple class enrollments per student
- ✅ Historical enrollment tracking

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 ClassesController                   │
│  - POST /classes (ADMIN only)                       │
│  - GET /classes (ADMIN, STAFF)                      │
│  - GET /classes/:id (ADMIN, STAFF)                  │
│  - PATCH /classes/:id (ADMIN only)                  │
│  - POST /classes/:id/students (ADMIN only)          │
│  - DELETE /classes/:id/students/:studentId (ADMIN)  │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│                 ClassesService                      │
│  - create(): Create class with ACTIVE status        │
│  - findAll(): List with pagination & filters        │
│  - findOne(): Get with active enrollments           │
│  - update(): Update details or archive              │
│  - enrollStudent(): Enroll with duplicate check     │
│  - unenrollStudent(): Soft delete enrollment        │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│                 PrismaService                       │
│  - class: CRUD operations                           │
│  - classEnrollment: Enrollment management           │
│  - Unique constraints enforced at DB level          │
└─────────────────────────────────────────────────────┘
```

## Data Models

### Class Model

```typescript
{
  id: string;              // UUID primary key
  name: string;            // Unique class name
  description: string?;    // Optional description
  status: ClassStatus;     // ACTIVE or ARCHIVED
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

### ClassEnrollment Model

```typescript
{
  id: string;                 // UUID primary key
  studentId: string;          // FK to Student
  classId: string;            // FK to Class
  status: EnrollmentStatus;   // ACTIVE or INACTIVE
  enrolledAt: DateTime;       // Enrollment timestamp
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

**Unique Constraint**: `(studentId, classId)` - Prevents duplicate enrollments

## API Endpoints

### POST /classes
Create a new class (ADMIN only)

**Request**:
```json
{
  "name": "Batch 2024 Morning",
  "description": "Morning batch for 2024 intake"
}
```

**Response**: `201 Created`

---

### GET /classes
List all classes with optional filtering

**Query Parameters**:
- `status` (optional): ACTIVE | ARCHIVED
- `page` (optional, default: 1)
- `limit` (optional, default: 10)

**Response**: `200 OK`
```json
{
  "data": [...],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### GET /classes/:id
Get single class with active enrollments

**Response**: `200 OK` - Includes `enrollments` array with only ACTIVE enrollments

---

### PATCH /classes/:id
Update class details (ADMIN only)

**Request**:
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "status": "ARCHIVED"
}
```

**Response**: `200 OK`

---

### POST /classes/:id/students
Enroll student in class (ADMIN only)

**Request**:
```json
{
  "studentId": "uuid-here"
}
```

**Response**: `201 Created`

**Special Behavior**: If enrollment exists with INACTIVE status, it will be reactivated with a new `enrolledAt` timestamp.

---

### DELETE /classes/:id/students/:studentId
Unenroll student from class (ADMIN only)

**Response**: `200 OK`

**Important**: This is a soft delete. The enrollment record is retained with status=INACTIVE for historical reporting.

---

## Business Rules

### 1. Unique Class Names
- Class names must be unique across the entire system
- Duplicate names return `409 Conflict` error
- Case-sensitive uniqueness enforced by database

### 2. Default Status
- New classes default to `ACTIVE` status
- Only ACTIVE and ARCHIVED statuses are supported
- Archived classes are hidden from student views

### 3. Enrollment Management
- Students can be enrolled in multiple classes simultaneously
- Duplicate enrollments in same class are prevented (unique constraint)
- Enrollments default to `ACTIVE` status

### 4. Soft Delete (Unenrollment)
- Unenrolling sets enrollment status to `INACTIVE`
- Record is retained in database for historical reporting
- INACTIVE enrollments excluded from GET /classes/:id response
- Re-enrollment is possible and reactivates the enrollment

### 5. Active Enrollments Only
- GET /classes/:id returns only ACTIVE enrollments
- Enrollment count in list view only includes ACTIVE
- This ensures attendance registers use current class roster

### 6. Multiple Enrollments
- A student can be enrolled in multiple classes at the same time
- Each class maintains independent enrollment status
- Attendance tracking is per-class (see Attendance module)

## Access Control

### ADMINISTRATOR / SUPER_ADMIN
- ✅ Create classes
- ✅ Update classes
- ✅ Archive classes
- ✅ View all classes
- ✅ Enroll students
- ✅ Unenroll students

### STAFF
- ✅ View all classes
- ✅ View class details
- ❌ Cannot create/update/enroll/unenroll

### STUDENT
- ❌ No access to class management endpoints
- (Students see their enrollments via Student module)

## Error Handling

### 400 Bad Request
- Missing required fields
- Invalid UUID format
- Invalid status value

### 401 Unauthorized
- No JWT token provided
- Expired or invalid token

### 403 Forbidden
- Insufficient role (e.g., STAFF attempting to create class)
- Missing required permission

### 404 Not Found
- Class ID does not exist
- Student ID does not exist
- Enrollment not found

### 409 Conflict
- Duplicate class name
- Student already enrolled in class (ACTIVE enrollment exists)

## Testing

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for comprehensive testing instructions including:
- 45 test cases covering all functionality
- 3 integration test scenarios
- Database verification queries
- Manual testing checklist

## Dependencies

- **PrismaModule**: Database access
- **AuthModule**: JWT authentication and role guards
- **StudentsModule**: Student validation (implicit via foreign key)

## Files Structure

```
classes/
├── classes.module.ts           # Module definition
├── classes.controller.ts       # HTTP endpoints
├── classes.controller.spec.ts  # Controller unit tests
├── classes.service.ts          # Business logic
├── classes.service.spec.ts     # Service unit tests
├── dto/
│   ├── create-class.dto.ts     # Create validation
│   ├── update-class.dto.ts     # Update validation
│   ├── enroll-student.dto.ts   # Enrollment validation
│   └── query-class.dto.ts      # Query parameters
├── TESTING_GUIDE.md            # Testing documentation
└── README.md                   # This file
```

## Usage Examples

### Creating and Enrolling Students

```typescript
// 1. Create a class
POST /classes
{
  "name": "Tax Preparation Batch A",
  "description": "Comprehensive tax preparation course"
}
// Response: { id: "class-uuid", status: "ACTIVE", ... }

// 2. Enroll students
POST /classes/class-uuid/students
{ "studentId": "student1-uuid" }

POST /classes/class-uuid/students
{ "studentId": "student2-uuid" }

// 3. Get class with enrollments
GET /classes/class-uuid
// Response includes active enrollments array

// 4. Unenroll a student
DELETE /classes/class-uuid/students/student1-uuid
// Enrollment status becomes INACTIVE

// 5. Re-enroll the same student
POST /classes/class-uuid/students
{ "studentId": "student1-uuid" }
// Enrollment reactivated with new timestamp
```

### Archiving a Class

```typescript
// Archive a completed class
PATCH /classes/class-uuid
{
  "status": "ARCHIVED"
}
// Class no longer appears in student views
// Historical data retained
```

## Integration with Other Modules

### Attendance Module (Task 13-20)
- Attendance registers use class enrollments
- Frozen roster captures snapshot of ACTIVE enrollments
- Each class maintains independent attendance tracking

### Students Module (Task 9)
- Student validation during enrollment
- Class enrollments displayed in student profile
- Foreign key constraint ensures referential integrity

### Reports Module (Task 17-19)
- Monthly attendance reports grouped by class
- INACTIVE enrollments excluded from current reports
- Historical reporting includes all enrollment statuses

## Database Schema

```sql
-- Class table
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR UNIQUE NOT NULL,
  description TEXT,
  status VARCHAR NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Class enrollment table
CREATE TABLE class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  status VARCHAR NOT NULL DEFAULT 'ACTIVE',
  enrolled_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, class_id)
);

-- Indexes
CREATE INDEX idx_classes_name ON classes(name);
CREATE INDEX idx_classes_status ON classes(status);
CREATE INDEX idx_class_enrollments_student_id ON class_enrollments(student_id);
CREATE INDEX idx_class_enrollments_class_id ON class_enrollments(class_id);
CREATE INDEX idx_class_enrollments_status ON class_enrollments(status);
```

## Requirements Validation

This module fully implements **Requirement R4: Class Management** with all 10 acceptance criteria:

| Criteria | Description | Status |
|----------|-------------|--------|
| R4.1 | Unique class names required | ✅ |
| R4.2 | Default status is ACTIVE | ✅ |
| R4.3 | Enrollments created with ACTIVE status | ✅ |
| R4.4 | Prevent duplicate enrollments | ✅ |
| R4.5 | Unenrollment sets INACTIVE status | ✅ |
| R4.6 | Retain inactive enrollments | ✅ |
| R4.7 | Return only ACTIVE enrollments | ✅ |
| R4.8 | Support archiving classes | ✅ |
| R4.9 | Multiple class enrollments per student | ✅ |
| R4.10 | Independent attendance per class | ✅ |

## Contributing

When modifying this module:

1. Update both controller and service tests
2. Run all test suites: `npm test -- classes`
3. Update TESTING_GUIDE.md with new test cases
4. Verify database constraints still enforced
5. Test error handling for new edge cases
6. Update this README if API changes

## Troubleshooting

**Issue**: 409 Conflict on enrollment
- **Cause**: Student already enrolled with ACTIVE status
- **Solution**: Check existing enrollments before retry

**Issue**: Enrollment not appearing in GET /classes/:id
- **Cause**: Enrollment status is INACTIVE
- **Solution**: Re-enroll student to reactivate

**Issue**: Cannot create class with same name
- **Cause**: Name must be unique (database constraint)
- **Solution**: Use a different name or update existing class

**Issue**: 403 Forbidden on class operations
- **Cause**: User role lacks permission
- **Solution**: Ensure user has ADMINISTRATOR or SUPER_ADMIN role

## Performance Considerations

- **Pagination**: Always use pagination for listing classes
- **Indexes**: Database indexes on name, status, and foreign keys
- **Soft Delete**: INACTIVE enrollments retained but filtered out
- **Unique Constraints**: Enforced at database level for data integrity

## Future Enhancements

Potential improvements for future releases:

- Bulk enrollment (enroll multiple students at once)
- Class capacity limits
- Auto-archive classes after end date
- Class schedules and timetables
- Parent-child class relationships
- Class categories/tags
