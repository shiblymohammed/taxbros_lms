# Staff Module Testing Guide

## Overview

This guide provides instructions for testing the Staff Profile Management and Permissions functionality.

## Prerequisites

1. Database is running and accessible
2. Migrations have been applied:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
3. API server is running:
   ```bash
   npm run start:dev
   ```
4. You have an ADMINISTRATOR account with valid JWT token

## Unit Tests

### Running Tests

```bash
# Run all staff tests
npm test staff

# Run specific test files
npm test staff.service.spec.ts
npm test staff.controller.spec.ts

# Run with coverage
npm test -- --coverage staff
```

### Test Coverage

The test suite covers:
- ✅ Staff profile CRUD operations
- ✅ Uniqueness constraint validation
- ✅ Search and filtering
- ✅ Pagination
- ✅ Permission grant/revoke
- ✅ Error handling
- ✅ Cascade operations

## Manual API Testing

### Setup

1. Get an admin JWT token:
   ```bash
   POST http://localhost:3001/auth/login
   Content-Type: application/json
   
   {
     "email": "admin@taxbros.com",
     "password": "admin_password"
   }
   ```

2. Save the access token from the response

### Test Scenarios

#### Scenario 1: Create Staff Profile

**Test Case 1.1: Create Teaching Staff**
```bash
POST http://localhost:3001/staff
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "userId": "existing-user-uuid",
  "staffId": "STF001",
  "firstName": "John",
  "lastName": "Doe",
  "designation": "Professor",
  "department": "Computer Science",
  "category": "TEACHING",
  "joiningDate": "2024-01-15",
  "phoneNumber": "1234567890",
  "address": "123 Main St, City"
}
```

**Expected Result:**
- Status: 201 Created
- Response includes staff profile with user details
- Returns generated UUID

**Test Case 1.2: Create with Duplicate staffId**
```bash
POST http://localhost:3001/staff
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "userId": "another-user-uuid",
  "staffId": "STF001",
  "firstName": "Jane",
  "lastName": "Smith",
  "designation": "Lecturer",
  "department": "Mathematics",
  "category": "TEACHING",
  "joiningDate": "2024-02-01"
}
```

**Expected Result:**
- Status: 409 Conflict
- Error message: "Staff ID already exists"

**Test Case 1.3: Create with Invalid Data**
```bash
POST http://localhost:3001/staff
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "userId": "user-uuid",
  "staffId": "",
  "firstName": "Test",
  "category": "INVALID_CATEGORY"
}
```

**Expected Result:**
- Status: 400 Bad Request
- Validation errors for missing/invalid fields

#### Scenario 2: List Staff with Filters

**Test Case 2.1: Get All Staff**
```bash
GET http://localhost:3001/staff?page=1&limit=10
Authorization: Bearer <your_token>
```

**Expected Result:**
- Status: 200 OK
- Paginated list of staff
- Includes user details and permissions

**Test Case 2.2: Filter by Department**
```bash
GET http://localhost:3001/staff?department=Computer Science&page=1&limit=10
Authorization: Bearer <your_token>
```

**Expected Result:**
- Status: 200 OK
- Only staff from Computer Science department

**Test Case 2.3: Filter by Category**
```bash
GET http://localhost:3001/staff?category=TEACHING&page=1&limit=10
Authorization: Bearer <your_token>
```

**Expected Result:**
- Status: 200 OK
- Only teaching staff members

**Test Case 2.4: Search Staff**
```bash
GET http://localhost:3001/staff?search=John&page=1&limit=10
Authorization: Bearer <your_token>
```

**Expected Result:**
- Status: 200 OK
- Staff matching "John" in firstName, lastName, staffId, or designation

#### Scenario 3: Get Staff by ID

**Test Case 3.1: Get Existing Staff**
```bash
GET http://localhost:3001/staff/{staff-uuid}
Authorization: Bearer <your_token>
```

**Expected Result:**
- Status: 200 OK
- Complete staff profile with permissions list

**Test Case 3.2: Get Non-existent Staff**
```bash
GET http://localhost:3001/staff/non-existent-uuid
Authorization: Bearer <your_token>
```

**Expected Result:**
- Status: 404 Not Found
- Error message: "Staff not found"

#### Scenario 4: Update Staff Profile

**Test Case 4.1: Update Designation**
```bash
PATCH http://localhost:3001/staff/{staff-uuid}
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "designation": "Senior Professor"
}
```

**Expected Result:**
- Status: 200 OK
- Updated staff profile returned

**Test Case 4.2: Update Department**
```bash
PATCH http://localhost:3001/staff/{staff-uuid}
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "department": "Information Technology"
}
```

**Expected Result:**
- Status: 200 OK
- Department updated successfully

#### Scenario 5: Grant Permissions

**Test Case 5.1: Grant MARK_ATTENDANCE Permission**
```bash
POST http://localhost:3001/staff/{staff-uuid}/permissions
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "permission": "MARK_ATTENDANCE"
}
```

**Expected Result:**
- Status: 201 Created
- Permission record with granter details

**Test Case 5.2: Grant Multiple Permissions**

Grant VIEW_REPORTS:
```bash
POST http://localhost:3001/staff/{staff-uuid}/permissions
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "permission": "VIEW_REPORTS"
}
```

Grant MANAGE_COURSES:
```bash
POST http://localhost:3001/staff/{staff-uuid}/permissions
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "permission": "MANAGE_COURSES"
}
```

**Expected Result:**
- Each returns 201 Created
- Multiple permission records created

**Test Case 5.3: Grant Duplicate Permission**
```bash
POST http://localhost:3001/staff/{staff-uuid}/permissions
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "permission": "MARK_ATTENDANCE"
}
```

**Expected Result:**
- Status: 409 Conflict
- Error: "Permission already granted to this staff member"

**Test Case 5.4: Grant Invalid Permission**
```bash
POST http://localhost:3001/staff/{staff-uuid}/permissions
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "permission": "INVALID_PERMISSION"
}
```

**Expected Result:**
- Status: 400 Bad Request
- Validation error for invalid enum value

#### Scenario 6: List Staff Permissions

**Test Case 6.1: Get All Permissions**
```bash
GET http://localhost:3001/staff/{staff-uuid}/permissions
Authorization: Bearer <your_token>
```

**Expected Result:**
- Status: 200 OK
- Array of all permissions for this staff member
- Ordered by grantedAt descending

#### Scenario 7: Revoke Permissions

**Test Case 7.1: Revoke Permission**
```bash
DELETE http://localhost:3001/staff/{staff-uuid}/permissions/{permission-uuid}
Authorization: Bearer <your_token>
```

**Expected Result:**
- Status: 200 OK
- Success message

**Test Case 7.2: Revoke Non-existent Permission**
```bash
DELETE http://localhost:3001/staff/{staff-uuid}/permissions/non-existent-uuid
Authorization: Bearer <your_token>
```

**Expected Result:**
- Status: 404 Not Found
- Error: "Permission not found"

**Test Case 7.3: Revoke Permission from Wrong Staff**
```bash
DELETE http://localhost:3001/staff/{wrong-staff-uuid}/permissions/{permission-uuid}
Authorization: Bearer <your_token>
```

**Expected Result:**
- Status: 400 Bad Request
- Error: "Permission does not belong to this staff member"

#### Scenario 8: Delete Staff Profile

**Test Case 8.1: Delete with Permissions**
```bash
# First verify staff has permissions
GET http://localhost:3001/staff/{staff-uuid}/permissions
Authorization: Bearer <your_token>

# Then delete staff
DELETE http://localhost:3001/staff/{staff-uuid}
Authorization: Bearer <your_token>

# Verify permissions are also deleted (cascade)
GET http://localhost:3001/staff/{staff-uuid}/permissions
Authorization: Bearer <your_token>
```

**Expected Result:**
- Delete returns 200 OK with success message
- Subsequent GET returns 404 Not Found
- Permissions automatically deleted (cascade)

#### Scenario 9: Authorization Tests

**Test Case 9.1: Access without Authentication**
```bash
GET http://localhost:3001/staff
# No Authorization header
```

**Expected Result:**
- Status: 401 Unauthorized

**Test Case 9.2: Access with Non-Admin Role**
```bash
# Login as STAFF user
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "email": "staff@taxbros.com",
  "password": "staff_password"
}

# Try to access staff endpoints
GET http://localhost:3001/staff
Authorization: Bearer <staff_token>
```

**Expected Result:**
- Status: 403 Forbidden
- Only ADMINISTRATOR can access these endpoints

## Integration Tests

### Test Flow: Complete Staff Lifecycle

1. **Create Staff Profile**
   - Create user account (STAFF role)
   - Create staff profile linked to user
   - Verify profile creation

2. **Grant Permissions**
   - Grant MARK_ATTENDANCE
   - Grant VIEW_REPORTS
   - Verify permissions list

3. **Use Permissions** (in other modules)
   - Attempt to mark attendance
   - Verify permission check works

4. **Update Profile**
   - Update designation
   - Update department
   - Verify updates persist

5. **Revoke Permissions**
   - Revoke VIEW_REPORTS
   - Verify immediate effect

6. **Delete Profile**
   - Delete staff profile
   - Verify cascade deletion of permissions
   - Verify user account remains

## Database Verification

### Check Staff Records
```sql
-- View all staff
SELECT * FROM staff;

-- View staff with user details
SELECT s.*, u.email, u.role, u.status
FROM staff s
JOIN users u ON s."userId" = u.id;

-- Count by department
SELECT department, COUNT(*) as count
FROM staff
GROUP BY department;

-- Count by category
SELECT category, COUNT(*) as count
FROM staff
GROUP BY category;
```

### Check Permission Records
```sql
-- View all permissions
SELECT * FROM staff_permissions;

-- View permissions with staff details
SELECT 
  sp.*,
  s."staffId",
  s."firstName",
  s."lastName"
FROM staff_permissions sp
JOIN staff s ON sp."staffId" = s.id;

-- Count permissions by type
SELECT permission, COUNT(*) as count
FROM staff_permissions
GROUP BY permission;

-- Staff with multiple permissions
SELECT 
  s."staffId",
  s."firstName",
  s."lastName",
  COUNT(sp.id) as permission_count
FROM staff s
LEFT JOIN staff_permissions sp ON s.id = sp."staffId"
GROUP BY s.id, s."staffId", s."firstName", s."lastName"
HAVING COUNT(sp.id) > 1;
```

### Verify Constraints
```sql
-- Test unique constraint on staffId
INSERT INTO staff ("id", "userId", "staffId", "firstName", "lastName", "designation", "department", "category", "joiningDate")
VALUES (gen_random_uuid(), 'test-user', 'STF001', 'Test', 'User', 'Test', 'Test', 'TEACHING', NOW());
-- Should fail with unique constraint violation

-- Test unique constraint on (staffId, permission)
INSERT INTO staff_permissions ("id", "staffId", "permission", "grantedBy")
VALUES (gen_random_uuid(), 'existing-staff-id', 'MARK_ATTENDANCE', 'admin-id');
-- Second insert with same staffId and permission should fail
```

## Performance Testing

### Load Test: Create Multiple Staff
```bash
# Create 100 staff members
for i in {1..100}; do
  curl -X POST http://localhost:3001/staff \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"user-$i\",
      \"staffId\": \"STF$(printf '%03d' $i)\",
      \"firstName\": \"Staff\",
      \"lastName\": \"$i\",
      \"designation\": \"Lecturer\",
      \"department\": \"Department $((i % 5))\",
      \"category\": \"TEACHING\",
      \"joiningDate\": \"2024-01-15\"
    }"
done
```

### Query Performance
```bash
# Test pagination with large dataset
curl "http://localhost:3001/staff?page=1&limit=50" \
  -H "Authorization: Bearer <token>"

# Test filtering performance
curl "http://localhost:3001/staff?department=Computer%20Science&category=TEACHING&page=1&limit=20" \
  -H "Authorization: Bearer <token>"

# Test search performance
curl "http://localhost:3001/staff?search=Professor&page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

## Common Issues and Solutions

### Issue 1: Database Connection Error
**Symptom:** Unable to connect to database
**Solution:** 
- Check DATABASE_URL in .env file
- Ensure PostgreSQL is running
- Verify credentials

### Issue 2: Migration Not Applied
**Symptom:** StaffPermissionType enum not found
**Solution:**
```bash
npx prisma migrate deploy
npx prisma generate
```

### Issue 3: Permission Denied
**Symptom:** 403 Forbidden when accessing endpoints
**Solution:**
- Verify user has ADMINISTRATOR role
- Check JWT token is valid
- Verify RolesGuard is working

### Issue 4: Unique Constraint Violation
**Symptom:** Error when creating staff with existing staffId
**Solution:**
- Use unique staffId for each staff member
- Check existing staff before creation
- Handle conflict errors properly

## Test Checklist

### Core Functionality
- [ ] Create staff profile successfully
- [ ] Validate staffId uniqueness
- [ ] Filter staff by department
- [ ] Filter staff by category
- [ ] Search staff by name/staffId
- [ ] Pagination works correctly
- [ ] Update staff profile
- [ ] Delete staff profile

### Permission Management
- [ ] Grant permission successfully
- [ ] Prevent duplicate permissions
- [ ] List all staff permissions
- [ ] Revoke permission successfully
- [ ] Cascade delete permissions with staff

### Error Handling
- [ ] 404 for non-existent staff
- [ ] 409 for duplicate staffId
- [ ] 400 for invalid input
- [ ] 401 without authentication
- [ ] 403 without proper role

### Data Integrity
- [ ] Unique constraint on staffId
- [ ] Unique constraint on (staffId, permission)
- [ ] Foreign key constraints work
- [ ] Cascade delete works
- [ ] Timestamps are recorded

### Security
- [ ] All endpoints require authentication
- [ ] All endpoints require ADMINISTRATOR role
- [ ] JWT validation works
- [ ] Permission audit trail recorded

## Success Criteria

✅ All unit tests pass
✅ All API endpoints return expected results
✅ Error handling works correctly
✅ Data integrity constraints enforced
✅ Security controls functional
✅ Performance acceptable with large datasets
✅ Documentation accurate and complete

## Next Steps After Testing

1. **Integration with Attendance Module**
   - Test MARK_ATTENDANCE permission
   - Verify staff can mark attendance when permitted

2. **Integration with Reports Module**
   - Test VIEW_REPORTS permission
   - Verify report access control

3. **User Interface Testing**
   - Test staff management UI
   - Test permission grant/revoke UI

4. **End-to-End Testing**
   - Complete user workflows
   - Cross-module functionality
