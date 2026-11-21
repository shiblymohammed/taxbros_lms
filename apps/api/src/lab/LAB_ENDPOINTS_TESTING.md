# Lab Endpoints Testing Guide

This document provides testing instructions for the lab endpoints implementation.

## Task 53 Implementation Summary

✅ **Lab Controller** - Created with all required endpoints  
✅ **Lab Service** - Implements business logic for lab operations  
✅ **DTOs** - Input validation for all lab types  
✅ **Module Integration** - LabModule registered in AppModule  
✅ **Unit Tests** - Comprehensive test coverage for controller and service  
✅ **Build** - Compiles successfully without errors  

## Endpoints Overview

### 1. GET /labs
**Purpose:** List all labs (students see active only)  
**Auth:** Required (all roles)  
**Requirements:** R27

**Test:**
```bash
# As Student
curl -X GET http://localhost:3000/labs \
  -H "Authorization: Bearer <student_token>"

# As Administrator
curl -X GET http://localhost:3000/labs \
  -H "Authorization: Bearer <admin_token>"
```

### 2. GET /labs/:type
**Purpose:** Get lab details with sample data  
**Auth:** Required (all roles)  
**Requirements:** R27, R28, R29, R30

**Test:**
```bash
# Get GST Registration Lab
curl -X GET http://localhost:3000/labs/GST_REGISTRATION \
  -H "Authorization: Bearer <token>"

# Get Income Tax Return Lab
curl -X GET http://localhost:3000/labs/INCOME_TAX_RETURN \
  -H "Authorization: Bearer <token>"

# Get MCA Incorporation Lab
curl -X GET http://localhost:3000/labs/MCA_INCORPORATION \
  -H "Authorization: Bearer <token>"
```

### 3. POST /labs/:type/submit
**Purpose:** Submit lab attempt  
**Auth:** Student only  
**Requirements:** R28, R29, R30, R31

**Test GST Registration:**
```bash
curl -X POST http://localhost:3000/labs/GST_REGISTRATION/submit \
  -H "Authorization: Bearer <student_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Business Pvt Ltd",
    "businessType": "Private Limited",
    "pan": "TEST12345T",
    "address": "123 Fictional Street, Test City",
    "signatory": "John Test"
  }'
```

**Test Income Tax Return:**
```bash
curl -X POST http://localhost:3000/labs/INCOME_TAX_RETURN/submit \
  -H "Authorization: Bearer <student_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "taxpayerName": "Sample Taxpayer",
    "pan": "TEST00000T",
    "incomeSource": "Salary",
    "grossIncome": 800000,
    "deductions": 150000
  }'
```

**Test MCA Incorporation:**
```bash
curl -X POST http://localhost:3000/labs/MCA_INCORPORATION/submit \
  -H "Authorization: Bearer <student_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Company Private Limited",
    "directors": [
      {
        "name": "John Director",
        "din": "00000001",
        "email": "director@example.com"
      }
    ],
    "registeredAddress": "123 Fictional Street, Test City",
    "authorizedCapital": 100000
  }'
```

### 4. GET /labs/:type/attempts
**Purpose:** Get lab attempt history  
**Auth:** Required (students see own, admins see all)  
**Requirements:** R31

**Test:**
```bash
# As Student (sees own attempts)
curl -X GET http://localhost:3000/labs/GST_REGISTRATION/attempts \
  -H "Authorization: Bearer <student_token>"

# As Administrator (sees all attempts)
curl -X GET http://localhost:3000/labs/GST_REGISTRATION/attempts \
  -H "Authorization: Bearer <admin_token>"

# As Administrator (filter by student)
curl -X GET "http://localhost:3000/labs/GST_REGISTRATION/attempts?studentId=<student_id>" \
  -H "Authorization: Bearer <admin_token>"
```

### 5. GET /labs/attempts/:id
**Purpose:** Get detailed attempt information  
**Auth:** Required (students see own, admins see all)  
**Requirements:** R31

**Test:**
```bash
# View attempt details
curl -X GET http://localhost:3000/labs/attempts/<attempt_id> \
  -H "Authorization: Bearer <token>"
```

### 6. PATCH /labs/:type/sample-data
**Purpose:** Update lab sample data (admin only)  
**Auth:** Administrator only  
**Requirements:** R27

**Test:**
```bash
curl -X PATCH http://localhost:3000/labs/GST_REGISTRATION/sample-data \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleData": {
      "businessName": "Updated Sample Business",
      "businessType": "Proprietorship",
      "pan": "TEST00000T",
      "address": "456 Updated Street",
      "signatory": "Updated Signatory"
    }
  }'
```

## Access Control

### Student Role
- ✅ Can view all active labs
- ✅ Can view lab details for active labs
- ✅ Can submit lab attempts
- ✅ Can view own attempt history
- ✅ Can view own attempt details
- ❌ Cannot view inactive labs
- ❌ Cannot view other students' attempts
- ❌ Cannot update sample data

### Administrator Role
- ✅ Can view all labs (active and inactive)
- ✅ Can view lab details for any lab
- ✅ Can view all lab attempts
- ✅ Can filter attempts by student
- ✅ Can view any attempt details
- ✅ Can update sample data
- ❌ Cannot submit lab attempts (student-only)

## Validation Rules

### GST Registration Lab
- All fields required: businessName, businessType, pan, address, signatory
- PAN must match fictional pattern (e.g., TEST12345T)
- Realistic PAN patterns (e.g., AAAAA1234B) are rejected

### Income Tax Return Lab
- All fields required: taxpayerName, pan, incomeSource, grossIncome, deductions
- PAN must match fictional pattern
- grossIncome and deductions must be >= 0
- deductions cannot exceed grossIncome

### MCA Incorporation Lab
- Required: companyName, directors (min 1), registeredAddress, authorizedCapital
- Each director requires: name, din, email
- DIN must match fictional pattern (e.g., 00000001)
- Realistic DIN patterns are rejected
- authorizedCapital must be >= 0

## Expected Responses

### Success Responses

**Lab List (200):**
```json
[
  {
    "id": "uuid",
    "type": "GST_REGISTRATION",
    "title": "GST Registration",
    "description": "...",
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
]
```

**Lab Details (200):**
```json
{
  "id": "uuid",
  "type": "GST_REGISTRATION",
  "title": "GST Registration",
  "description": "...",
  "sampleData": {
    "businessName": "Sample Business",
    "businessType": "Proprietorship",
    "pan": "TEST00000T",
    "address": "123 Sample Street",
    "signatory": "Sample Signatory"
  },
  "isActive": true,
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z",
  "createdBy": "admin-uuid"
}
```

**Submission Success (201):**
```json
{
  "id": "attempt-uuid",
  "labId": "lab-uuid",
  "studentId": "student-uuid",
  "formData": { /* submitted data */ },
  "result": {
    "gstin": "00TEST12345TZ00",
    "arn": "AR1234567890123",
    "applicationDate": "2024-01-15",
    "status": "Approved (Simulated)"
  },
  "completedAt": "2024-01-15T10:30:00.000Z",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "lab": {
    "type": "GST_REGISTRATION",
    "title": "GST Registration"
  }
}
```

### Error Responses

**Invalid Lab Type (400):**
```json
{
  "statusCode": 400,
  "message": "Invalid lab type",
  "error": "Bad Request"
}
```

**Lab Not Found (404):**
```json
{
  "statusCode": 404,
  "message": "Lab with type GST_REGISTRATION not found",
  "error": "Not Found"
}
```

**Inactive Lab (403):**
```json
{
  "statusCode": 403,
  "message": "This lab is not currently active",
  "error": "Forbidden"
}
```

**Validation Error (400):**
```json
{
  "statusCode": 400,
  "message": "Business Name is required",
  "error": "Bad Request"
}
```

**Realistic PAN Pattern (400):**
```json
{
  "statusCode": 400,
  "message": "PAN pattern appears realistic. Please use fictional patterns for training (e.g., TEST00000T)",
  "error": "Bad Request"
}
```

## Integration with Existing Systems

### Database Schema
- Uses existing `Lab` and `LabAttempt` models from Prisma schema
- Lab types: GST_REGISTRATION, INCOME_TAX_RETURN, MCA_INCORPORATION
- Student relationship validated through existing Student model

### Authentication
- Uses existing JWT authentication (JwtAuthGuard)
- Implements role-based access control (RolesGuard)
- Leverages @CurrentUser decorator for user context

### Lab Services
- Integrates with GstLabService (Task 50)
- Integrates with ItrLabService (Task 51)
- Integrates with McaLabService (Task 52)
- Uses LabValidationService for common validation

## Testing Checklist

### Unit Tests
- [x] Lab Controller tests created
- [x] Lab Service tests created
- [x] All endpoints covered
- [x] Role-based access tested
- [x] Error scenarios tested
- [x] Validation logic tested

### Integration Tests (Manual)
- [ ] Test with actual database
- [ ] Test authentication flow
- [ ] Test student submission flow
- [ ] Test administrator management flow
- [ ] Test attempt history retrieval
- [ ] Test sample data updates

### End-to-End Tests
- [ ] Complete student workflow (view lab → submit → view attempts)
- [ ] Administrator workflow (manage labs → view all attempts)
- [ ] Test all three lab types
- [ ] Verify data persistence
- [ ] Test concurrent submissions

## Files Created

1. `src/lab/lab.controller.ts` - REST API endpoints
2. `src/lab/lab.service.ts` - Business logic
3. `src/lab/dto/submit-gst-lab.dto.ts` - GST submission DTO
4. `src/lab/dto/submit-itr-lab.dto.ts` - ITR submission DTO
5. `src/lab/dto/submit-mca-lab.dto.ts` - MCA submission DTO
6. `src/lab/dto/update-sample-data.dto.ts` - Sample data update DTO
7. `src/lab/dto/index.ts` - DTO exports
8. `src/lab/lab.controller.spec.ts` - Controller unit tests
9. `src/lab/lab.service.spec.ts` - Service unit tests

## Files Modified

1. `src/lab/lab.module.ts` - Added controller and service
2. `src/app.module.ts` - Registered LabModule
3. `src/lab/index.ts` - Exported new components

## Requirements Coverage

- ✅ **R27:** Government Portal Lab Management
  - Lab listing with isActive filter
  - Lab details retrieval
  - Sample data management
  
- ✅ **R28:** GST Registration Simulation
  - Form submission with validation
  - Fictional PAN pattern enforcement
  - GSTIN and ARN generation
  
- ✅ **R29:** Income Tax Return Simulation
  - Form submission with validation
  - Tax calculation
  - Acknowledgement number generation
  
- ✅ **R30:** MCA Incorporation Simulation
  - Form submission with validation
  - Fictional DIN pattern enforcement
  - CIN generation
  
- ✅ **R31:** Lab Attempt Tracking
  - Attempt creation and storage
  - History retrieval
  - Detail view

## Next Steps

1. Run integration tests with actual database
2. Verify authentication flow works correctly
3. Test all validation scenarios
4. Create seed data for initial labs (Task 54)
5. Update API documentation with new endpoints
6. Deploy and test in staging environment
