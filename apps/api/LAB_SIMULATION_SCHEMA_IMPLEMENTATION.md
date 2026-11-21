# Lab Simulation Schema Implementation

## Overview

This document details the implementation of the lab simulation database schema for the TAXBROS LMS. The schema supports three types of government portal simulations: GST Registration, Income Tax Return filing, and MCA Incorporation.

## Schema Design

### Lab Model

The `Lab` model stores the configuration and sample data for each lab simulation type.

**Fields:**
- `id` (String, UUID): Primary key
- `type` (LabType enum): Unique identifier for the lab type
  - `GST_REGISTRATION`
  - `INCOME_TAX_RETURN`
  - `MCA_INCORPORATION`
- `title` (String): Display title for the lab
- `description` (String?, optional): Detailed description of the lab
- `sampleData` (Json): Fictional sample data used in the simulation
- `isActive` (Boolean): Flag to enable/disable the lab (default: true)
- `createdAt` (DateTime): Timestamp of creation
- `updatedAt` (DateTime): Timestamp of last update
- `createdBy` (String?, optional): User ID of the creator

**Constraints:**
- Unique constraint on `type` field - ensures only one lab per simulation type

**Indexes:**
- Index on `type` - optimizes lookups by lab type
- Index on `isActive` - optimizes filtering active labs

**Relations:**
- One-to-many with `LabAttempt` model

### LabAttempt Model

The `LabAttempt` model tracks each student's submission with their form data and generated results.

**Fields:**
- `id` (String, UUID): Primary key
- `labId` (String): Foreign key to Lab
- `studentId` (String): Foreign key to Student
- `formData` (Json): Student's submitted form data
- `result` (Json): Generated simulation results (GSTIN, ARN, CIN, etc.)
- `completedAt` (DateTime): Timestamp when the attempt was completed
- `createdAt` (DateTime): Timestamp of creation
- `updatedAt` (DateTime): Timestamp of last update

**Indexes:**
- Composite index on `(labId, studentId)` - optimizes queries for student's lab history
- Index on `labId` - optimizes lab-specific queries
- Index on `studentId` - optimizes student-specific queries

**Relations:**
- Many-to-one with `Lab` model (cascade delete)
- Many-to-one with `Student` model (cascade delete)

## Migration Details

**Migration Name:** `20261120070409_add_lab_simulation_schema`

**Location:** `prisma/migrations/20261120070409_add_lab_simulation_schema/migration.sql`

**Applied:** ✅ Successfully applied to database

**Migration Actions:**
1. Created `LabType` enum with three values
2. Created `labs` table with all required fields
3. Created `lab_attempts` table with all required fields
4. Added unique constraint on `labs.type`
5. Added indexes for performance optimization
6. Added foreign key constraints with cascade delete

## Database Status

**Current State:** All schema components are successfully deployed and operational.

**Verification Results:**
- ✅ Lab model accessible with LabType enum
- ✅ LabAttempt model accessible
- ✅ Unique constraint on lab type working correctly
- ✅ sampleData and result JSON fields functioning properly
- ✅ isActive boolean flag present and working
- ✅ Index on (labId, studentId) functioning correctly
- ✅ Foreign key relationships established
- ✅ Cascade delete working for lab attempts

**Existing Labs in Database:**
1. **GST_REGISTRATION**
   - Title: GST Registration Practice Lab
   - Description: Practice GST registration procedures with fictional data
   - Status: Active

2. **INCOME_TAX_RETURN**
   - Title: Income Tax Return Filing Practice Lab
   - Description: Practice filing income tax returns with sample taxpayer data
   - Status: Active

3. **MCA_INCORPORATION**
   - Title: MCA Company Incorporation Practice Lab
   - Description: Practice company incorporation procedures through the MCA portal
   - Status: Active

## Requirements Validation

This implementation satisfies the following requirements from the specification:

**Requirement R27:** Lab Simulation Access
- Labs are accessible by type through unique constraint
- Sample data stored in structured JSON format

**Requirement R31:** Lab Attempt Storage
- Lab attempts tracked with formData and result fields
- Student submissions stored with generated results
- Efficient querying through composite index on (labId, studentId)

**Test Coverage T6:** Lab Structure
- Lab model structure matches design specification
- LabAttempt model structure matches design specification
- All required fields, constraints, and indexes implemented

## Schema Validation

To verify the schema implementation, the following tests were performed:

```typescript
// Test 1: Lab model accessibility
✓ Lab model accessible
✓ LabType enum contains all three types

// Test 2: LabAttempt model accessibility
✓ LabAttempt model accessible

// Test 3: Unique constraint on lab type
✓ Only one lab per type can exist in database

// Test 4: JSON field functionality
✓ sampleData field stores complex JSON objects
✓ result field stores generated simulation results
✓ formData field stores student submissions

// Test 5: Index performance
✓ Composite index on (labId, studentId) enables efficient queries
✓ Query performance optimized for student lab history

// Test 6: Foreign key relationships
✓ Lab attempts properly linked to labs
✓ Lab attempts properly linked to students
✓ Cascade delete working correctly
```

## Usage Examples

### Creating a Lab

```typescript
const lab = await prisma.lab.create({
  data: {
    type: 'GST_REGISTRATION',
    title: 'GST Registration Practice Lab',
    description: 'Practice GST registration with fictional data',
    sampleData: {
      businessName: 'Sample Business Pvt Ltd',
      pan: 'ABCDE1234F',
      state: 'Maharashtra',
      businessType: 'Private Limited Company'
    },
    isActive: true,
  },
});
```

### Recording a Lab Attempt

```typescript
const attempt = await prisma.labAttempt.create({
  data: {
    labId: lab.id,
    studentId: student.id,
    formData: {
      businessName: 'My Test Business',
      pan: 'FGHIJ5678K',
      state: 'Karnataka',
      businessType: 'Sole Proprietorship'
    },
    result: {
      gstin: '29FGHIJ5678K1Z5',
      arn: 'AA290124012345',
      applicationDate: '2024-01-20',
      status: 'APPROVED'
    },
  },
});
```

### Querying Student Lab History

```typescript
const studentAttempts = await prisma.labAttempt.findMany({
  where: {
    studentId: student.id,
    labId: lab.id,
  },
  orderBy: {
    completedAt: 'desc',
  },
  include: {
    lab: {
      select: {
        title: true,
        type: true,
      },
    },
  },
});
```

## Next Steps

With the schema successfully implemented, the next development tasks are:

1. **Task 49:** Create lab service layer for business logic
2. **Task 50:** Implement lab controller with REST API endpoints
3. **Task 51:** Add lab validation logic for each simulation type
4. **Task 52:** Implement result generation for GST, ITR, and MCA labs
5. **Task 53:** Create frontend lab simulation components

## Maintenance Notes

- The unique constraint on `labs.type` ensures data integrity
- Sample data should always contain fictional, clearly marked test data
- Lab attempts preserve historical data even after labs are deactivated
- JSON fields allow flexible schema evolution without migrations
- Indexes optimize the most common query patterns (student history, lab lookups)

## Performance Considerations

- Composite index on `(labId, studentId)` provides optimal performance for student lab history queries
- JSON fields use PostgreSQL's native JSONB type for efficient storage and querying
- Cascade deletes ensure referential integrity without orphaned records
- Index on `isActive` field enables efficient filtering of active labs

---

**Implementation Date:** 2026-11-20  
**Task ID:** 48  
**Status:** ✅ Completed  
**Migration Applied:** Yes  
**Database Verified:** Yes
