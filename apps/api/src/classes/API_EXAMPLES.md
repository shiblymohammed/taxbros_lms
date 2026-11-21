# Class Management API - Usage Examples

Quick reference for testing the Classes API endpoints using curl and other tools.

## Prerequisites

1. **Start the API server**:
   ```bash
   cd apps/api
   npm run dev
   ```

2. **Obtain JWT Token**:
   ```bash
   curl -X POST http://localhost:3000/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@test.com",
       "password": "password123"
     }'
   ```

   Save the `accessToken` from the response.

3. **Set Token Variable** (PowerShell):
   ```powershell
   $token = "your-access-token-here"
   ```

   Or (Bash):
   ```bash
   export TOKEN="your-access-token-here"
   ```

---

## API Examples

### 1. Create a Class

**PowerShell**:
```powershell
$body = @{
    name = "Batch 2024 Morning"
    description = "Morning batch for 2024 intake"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/classes" `
    -Method POST `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body $body `
    -ContentType "application/json"
```

**curl (Bash/PowerShell)**:
```bash
curl -X POST http://localhost:3000/classes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Batch 2024 Morning",
    "description": "Morning batch for 2024 intake"
  }'
```

**Expected Response**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Batch 2024 Morning",
  "description": "Morning batch for 2024 intake",
  "status": "ACTIVE",
  "createdAt": "2024-11-18T10:00:00.000Z",
  "updatedAt": "2024-11-18T10:00:00.000Z"
}
```

---

### 2. List All Classes

**PowerShell**:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/classes" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $token" }
```

**curl**:
```bash
curl -X GET "http://localhost:3000/classes" \
  -H "Authorization: Bearer $TOKEN"
```

**With Filters**:
```bash
# Only active classes
curl -X GET "http://localhost:3000/classes?status=ACTIVE" \
  -H "Authorization: Bearer $TOKEN"

# Archived classes only
curl -X GET "http://localhost:3000/classes?status=ARCHIVED" \
  -H "Authorization: Bearer $TOKEN"

# With pagination
curl -X GET "http://localhost:3000/classes?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Batch 2024 Morning",
      "description": "Morning batch",
      "status": "ACTIVE",
      "createdAt": "2024-11-18T10:00:00.000Z",
      "updatedAt": "2024-11-18T10:00:00.000Z",
      "_count": {
        "enrollments": 5
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### 3. Get Single Class

**PowerShell**:
```powershell
$classId = "123e4567-e89b-12d3-a456-426614174000"
Invoke-RestMethod -Uri "http://localhost:3000/classes/$classId" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $token" }
```

**curl**:
```bash
CLASS_ID="123e4567-e89b-12d3-a456-426614174000"
curl -X GET "http://localhost:3000/classes/$CLASS_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Batch 2024 Morning",
  "description": "Morning batch",
  "status": "ACTIVE",
  "createdAt": "2024-11-18T10:00:00.000Z",
  "updatedAt": "2024-11-18T10:00:00.000Z",
  "enrollments": [
    {
      "id": "enrollment-uuid",
      "studentId": "student-uuid",
      "classId": "class-uuid",
      "status": "ACTIVE",
      "enrolledAt": "2024-11-18T10:00:00.000Z",
      "student": {
        "id": "student-uuid",
        "admissionId": "STU001",
        "firstName": "John",
        "lastName": "Doe",
        "user": {
          "email": "john@example.com",
          "status": "ACTIVE"
        }
      }
    }
  ]
}
```

---

### 4. Update Class

**PowerShell**:
```powershell
$classId = "123e4567-e89b-12d3-a456-426614174000"
$body = @{
    name = "Batch 2024 Morning - Updated"
    description = "Updated description"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/classes/$classId" `
    -Method PATCH `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body $body `
    -ContentType "application/json"
```

**curl**:
```bash
CLASS_ID="123e4567-e89b-12d3-a456-426614174000"
curl -X PATCH "http://localhost:3000/classes/$CLASS_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Batch 2024 Morning - Updated",
    "description": "Updated description"
  }'
```

**Archive a Class**:
```bash
curl -X PATCH "http://localhost:3000/classes/$CLASS_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ARCHIVED"
  }'
```

---

### 5. Enroll Student in Class

**PowerShell**:
```powershell
$classId = "123e4567-e89b-12d3-a456-426614174000"
$studentId = "student-uuid-here"
$body = @{
    studentId = $studentId
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/classes/$classId/students" `
    -Method POST `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body $body `
    -ContentType "application/json"
```

**curl**:
```bash
CLASS_ID="123e4567-e89b-12d3-a456-426614174000"
STUDENT_ID="student-uuid-here"

curl -X POST "http://localhost:3000/classes/$CLASS_ID/students" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\"
  }"
```

**Expected Response**:
```json
{
  "id": "enrollment-uuid",
  "studentId": "student-uuid",
  "classId": "class-uuid",
  "status": "ACTIVE",
  "enrolledAt": "2024-11-18T10:00:00.000Z",
  "createdAt": "2024-11-18T10:00:00.000Z",
  "updatedAt": "2024-11-18T10:00:00.000Z",
  "student": {
    "id": "student-uuid",
    "admissionId": "STU001",
    "firstName": "John",
    "lastName": "Doe",
    "user": {
      "email": "john@example.com",
      "status": "ACTIVE"
    }
  },
  "class": {
    "id": "class-uuid",
    "name": "Batch 2024 Morning",
    "status": "ACTIVE"
  }
}
```

---

### 6. Unenroll Student from Class

**PowerShell**:
```powershell
$classId = "123e4567-e89b-12d3-a456-426614174000"
$studentId = "student-uuid-here"

Invoke-RestMethod -Uri "http://localhost:3000/classes/$classId/students/$studentId" `
    -Method DELETE `
    -Headers @{ Authorization = "Bearer $token" }
```

**curl**:
```bash
CLASS_ID="123e4567-e89b-12d3-a456-426614174000"
STUDENT_ID="student-uuid-here"

curl -X DELETE "http://localhost:3000/classes/$CLASS_ID/students/$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "id": "enrollment-uuid",
  "studentId": "student-uuid",
  "classId": "class-uuid",
  "status": "INACTIVE",
  "enrolledAt": "2024-11-18T10:00:00.000Z",
  "createdAt": "2024-11-18T10:00:00.000Z",
  "updatedAt": "2024-11-18T15:45:00.000Z",
  "student": {
    "id": "student-uuid",
    "admissionId": "STU001",
    "firstName": "John",
    "lastName": "Doe"
  },
  "class": {
    "id": "class-uuid",
    "name": "Batch 2024 Morning"
  }
}
```

---

## Complete Integration Test Script

### PowerShell Script

```powershell
# Set base URL
$baseUrl = "http://localhost:3000"

# 1. Login and get token
$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" `
    -Method POST `
    -Body (@{ email = "admin@test.com"; password = "password123" } | ConvertTo-Json) `
    -ContentType "application/json"

$token = $loginResponse.accessToken
Write-Host "✅ Logged in successfully"

# 2. Create a class
$createClassBody = @{
    name = "Integration Test Batch"
    description = "Test batch for integration"
} | ConvertTo-Json

$class = Invoke-RestMethod -Uri "$baseUrl/classes" `
    -Method POST `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body $createClassBody `
    -ContentType "application/json"

Write-Host "✅ Created class: $($class.name) (ID: $($class.id))"

# 3. List classes
$classes = Invoke-RestMethod -Uri "$baseUrl/classes" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $token" }

Write-Host "✅ Found $($classes.meta.total) classes"

# 4. Get students list (to enroll)
$students = Invoke-RestMethod -Uri "$baseUrl/students" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $token" }

$studentId = $students.data[0].id
Write-Host "✅ Will enroll student: $studentId"

# 5. Enroll student
$enrollBody = @{ studentId = $studentId } | ConvertTo-Json
$enrollment = Invoke-RestMethod -Uri "$baseUrl/classes/$($class.id)/students" `
    -Method POST `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body $enrollBody `
    -ContentType "application/json"

Write-Host "✅ Enrolled student (Enrollment ID: $($enrollment.id))"

# 6. Get class with enrollments
$classWithEnrollments = Invoke-RestMethod -Uri "$baseUrl/classes/$($class.id)" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $token" }

Write-Host "✅ Class has $($classWithEnrollments.enrollments.Count) active enrollments"

# 7. Unenroll student
$unenrollResult = Invoke-RestMethod -Uri "$baseUrl/classes/$($class.id)/students/$studentId" `
    -Method DELETE `
    -Headers @{ Authorization = "Bearer $token" }

Write-Host "✅ Unenrolled student (Status: $($unenrollResult.status))"

# 8. Verify enrollment is inactive
$classAfterUnenroll = Invoke-RestMethod -Uri "$baseUrl/classes/$($class.id)" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $token" }

Write-Host "✅ Class now has $($classAfterUnenroll.enrollments.Count) active enrollments"

# 9. Archive class
$archiveBody = @{ status = "ARCHIVED" } | ConvertTo-Json
$archivedClass = Invoke-RestMethod -Uri "$baseUrl/classes/$($class.id)" `
    -Method PATCH `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body $archiveBody `
    -ContentType "application/json"

Write-Host "✅ Archived class (Status: $($archivedClass.status))"

Write-Host "`n🎉 Integration test completed successfully!"
```

### Bash Script

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"

# 1. Login
echo "Logging in..."
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}' \
  | jq -r '.accessToken')

echo "✅ Logged in successfully"

# 2. Create class
echo "Creating class..."
CLASS_ID=$(curl -s -X POST "$BASE_URL/classes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Integration Test Batch","description":"Test batch"}' \
  | jq -r '.id')

echo "✅ Created class: $CLASS_ID"

# 3. List classes
echo "Listing classes..."
curl -s -X GET "$BASE_URL/classes" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.meta'

# 4. Get student ID
echo "Getting student..."
STUDENT_ID=$(curl -s -X GET "$BASE_URL/students" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data[0].id')

echo "✅ Will enroll student: $STUDENT_ID"

# 5. Enroll student
echo "Enrolling student..."
curl -s -X POST "$BASE_URL/classes/$CLASS_ID/students" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\":\"$STUDENT_ID\"}" \
  | jq '.id'

echo "✅ Enrolled student"

# 6. Get class with enrollments
echo "Getting class details..."
curl -s -X GET "$BASE_URL/classes/$CLASS_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.enrollments | length'

echo "✅ Retrieved enrollments"

# 7. Unenroll student
echo "Unenrolling student..."
curl -s -X DELETE "$BASE_URL/classes/$CLASS_ID/students/$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.status'

echo "✅ Unenrolled student"

# 8. Archive class
echo "Archiving class..."
curl -s -X PATCH "$BASE_URL/classes/$CLASS_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ARCHIVED"}' \
  | jq '.status'

echo "✅ Archived class"
echo ""
echo "🎉 Integration test completed!"
```

---

## Postman Collection

Import this JSON into Postman:

```json
{
  "info": {
    "name": "Class Management API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "token",
      "value": ""
    },
    {
      "key": "classId",
      "value": ""
    },
    {
      "key": "studentId",
      "value": ""
    }
  ],
  "item": [
    {
      "name": "1. Login",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.collectionVariables.set('token', pm.response.json().accessToken);"
            ]
          }
        }
      ],
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"admin@test.com\",\n  \"password\": \"password123\"\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": "{{baseUrl}}/auth/login"
      }
    },
    {
      "name": "2. Create Class",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.collectionVariables.set('classId', pm.response.json().id);"
            ]
          }
        }
      ],
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"name\": \"Batch 2024 Morning\",\n  \"description\": \"Morning batch\"\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": "{{baseUrl}}/classes"
      }
    },
    {
      "name": "3. List Classes",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/classes?status=ACTIVE&page=1&limit=10",
          "host": ["{{baseUrl}}"],
          "path": ["classes"],
          "query": [
            { "key": "status", "value": "ACTIVE" },
            { "key": "page", "value": "1" },
            { "key": "limit", "value": "10" }
          ]
        }
      }
    },
    {
      "name": "4. Get Class",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": "{{baseUrl}}/classes/{{classId}}"
      }
    },
    {
      "name": "5. Update Class",
      "request": {
        "method": "PATCH",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"name\": \"Batch 2024 Morning - Updated\"\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": "{{baseUrl}}/classes/{{classId}}"
      }
    },
    {
      "name": "6. Enroll Student",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"studentId\": \"{{studentId}}\"\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": "{{baseUrl}}/classes/{{classId}}/students"
      }
    },
    {
      "name": "7. Unenroll Student",
      "request": {
        "method": "DELETE",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": "{{baseUrl}}/classes/{{classId}}/students/{{studentId}}"
      }
    }
  ]
}
```

---

## Common Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["name should not be empty"],
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
  "message": "Class with ID \"xyz\" not found",
  "error": "Not Found"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Class with name \"Batch 2024 Morning\" already exists",
  "error": "Conflict"
}
```

---

## Tips

1. **Save the token**: After login, save the `accessToken` to use in subsequent requests
2. **Save IDs**: Save class and student IDs from responses for use in other endpoints
3. **Check status codes**: Successful responses return 200 (GET, PATCH, DELETE) or 201 (POST)
4. **Verify soft delete**: After unenrollment, the student won't appear in GET /classes/:id
5. **Re-enrollment**: You can re-enroll a previously unenrolled student

---

## Quick Testing Flow

1. Login → Get token
2. Create class → Save class ID
3. Get students → Save student ID
4. Enroll student → Verify enrollment
5. Get class → See active enrollment
6. Unenroll student → Verify soft delete
7. Get class again → Enrollment gone
8. Re-enroll → Works again!
