# Students API Testing Guide

## Prerequisites

1. **API Running**: Ensure the API is running on `http://localhost:3000`
   ```bash
   npm run dev
   ```

2. **Database Setup**: Ensure PostgreSQL is running and migrations are applied
   ```bash
   npm run prisma:migrate
   ```

3. **Authentication**: Obtain a JWT token by logging in as an Administrator
   ```bash
   POST http://localhost:3000/api/auth/login
   {
     "email": "admin@example.com",
     "password": "your-password"
   }
   ```

## Test Scenarios

### Scenario 1: Create a Student Account

**Request:**
```http
POST http://localhost:3000/api/students
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "SecurePass123",
  "admissionId": "STU2024001",
  "firstName": "John",
  "lastName": "Doe",
  "admissionDate": "2024-01-15",
  "dateOfBirth": "2005-05-20",
  "gender": "Male",
  "phoneNumber": "1234567890",
  "address": "123 Main Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001"
}
```

**Expected Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440000",
  "admissionId": "STU2024001",
  "firstName": "John",
  "lastName": "Doe",
  "admissionDate": "2024-01-15T00:00:00.000Z",
  "user": {
    "email": "john.doe@example.com",
    "role": "STUDENT",
    "status": "PENDING",
    "mustChangePassword": true
  }
}
```

**Validation Tests:**
- Try with missing email → 400 Bad Request
- Try with password < 8 characters → 400 Bad Request
- Try with duplicate email → 409 Conflict
- Try with duplicate admissionId → 409 Conflict

---

### Scenario 2: List All Students (Paginated)

**Request:**
```http
GET http://localhost:3000/api/students?page=1&limit=20
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "admissionId": "STU2024001",
      "firstName": "John",
      "lastName": "Doe",
      "user": {
        "email": "john.doe@example.com",
        "role": "STUDENT",
        "status": "ACTIVE"
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### Scenario 3: Search Students by Name

**Request:**
```http
GET http://localhost:3000/api/students?search=john
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Behavior:**
- Returns students with "john" in firstName, lastName, admissionId, or email
- Search is case-insensitive
- Partial matches included

---

### Scenario 4: Filter by Admission Date Range

**Request:**
```http
GET http://localhost:3000/api/students?admissionDateFrom=2024-01-01&admissionDateTo=2024-12-31
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Behavior:**
- Returns only students admitted within the date range
- Dates are inclusive (>= from, <= to)

---

### Scenario 5: Get Single Student by ID

**Request:**
```http
GET http://localhost:3000/api/students/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440000",
  "admissionId": "STU2024001",
  "firstName": "John",
  "lastName": "Doe",
  "admissionDate": "2024-01-15T00:00:00.000Z",
  "dateOfBirth": "2005-05-20T00:00:00.000Z",
  "gender": "Male",
  "phoneNumber": "1234567890",
  "address": "123 Main Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "user": {
    "email": "john.doe@example.com",
    "role": "STUDENT",
    "status": "ACTIVE"
  }
}
```

**Validation Tests:**
- Try with non-existent ID → 404 Not Found
- Try as STUDENT role (once implemented) → Should see own profile only

---

### Scenario 6: Update Student Profile

**Request:**
```http
PATCH http://localhost:3000/api/students/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "firstName": "Jane",
  "phoneNumber": "9876543210",
  "city": "Delhi"
}
```

**Expected Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "admissionId": "STU2024001",
  "firstName": "Jane",
  "lastName": "Doe",
  "phoneNumber": "9876543210",
  "city": "Delhi",
  "user": {
    "email": "john.doe@example.com",
    "role": "STUDENT"
  }
}
```

**Validation Tests:**
- Try updating email to existing one → 409 Conflict
- Try updating admissionId to existing one → 409 Conflict
- Try with non-existent student ID → 404 Not Found
- Verify only provided fields are updated

---

## cURL Examples

### Create Student
```bash
curl -X POST http://localhost:3000/api/students \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "SecurePass123",
    "admissionId": "STU2024001",
    "firstName": "John",
    "lastName": "Doe",
    "admissionDate": "2024-01-15"
  }'
```

### List Students
```bash
curl -X GET "http://localhost:3000/api/students?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Search Students
```bash
curl -X GET "http://localhost:3000/api/students?search=john" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Student by ID
```bash
curl -X GET http://localhost:3000/api/students/STUDENT_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Student
```bash
curl -X PATCH http://localhost:3000/api/students/STUDENT_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "phoneNumber": "9876543210"
  }'
```

---

## Testing with Postman

1. **Import Collection**: Create a new collection named "Students API"

2. **Set Variables**:
   - `baseUrl`: `http://localhost:3000`
   - `token`: Your JWT token
   - `studentId`: A valid student ID

3. **Create Requests**:
   - POST Create Student
   - GET List Students
   - GET Get Student
   - PATCH Update Student

4. **Set Authorization**: Use `Bearer Token` type with `{{token}}` variable

---

## Common Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "password must be longer than or equal to 8 characters"
  ],
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Student not found",
  "error": "Not Found"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Email address is already in use",
  "error": "Conflict"
}
```

---

## Unit Testing

Run the unit tests:

```bash
# Run all student tests
npm test -- students

# Run with coverage
npm run test:cov -- students

# Watch mode during development
npm run test:watch -- students
```

---

## Integration Testing Checklist

- [ ] Create student with all required fields
- [ ] Create student with optional fields
- [ ] Verify email uniqueness enforcement
- [ ] Verify admissionId uniqueness enforcement
- [ ] List students with default pagination
- [ ] Search students by name
- [ ] Search students by email
- [ ] Search students by admission ID
- [ ] Filter by admission date range
- [ ] Get student by valid ID
- [ ] Get student by invalid ID (404)
- [ ] Update student with partial fields
- [ ] Update student email (conflict check)
- [ ] Update student admissionId (conflict check)
- [ ] Verify passwordHash never returned
- [ ] Test role-based access (ADMINISTRATOR only for create/update/list)
- [ ] Test pagination (page, limit, totalPages)

---

## Notes

1. **Password Security**: Passwords are hashed with bcrypt (12 salt rounds) and never returned in responses

2. **Default Values**:
   - New students: `status = PENDING`, `mustChangePassword = true`
   - Role automatically set to `STUDENT`

3. **Pagination**:
   - Default: `page=1`, `limit=10`
   - Maximum: `limit=100`

4. **Future Features**:
   - Class enrollment filtering (available after Task 12)
   - Course enrollment display (available after Task 30)
   - Student self-service profile viewing (ownership checks)

5. **Database Considerations**:
   - All timestamps stored in UTC
   - Dates converted to institute timezone (Asia/Kolkata) when displayed
   - Soft delete not implemented (use status=INACTIVE instead)
