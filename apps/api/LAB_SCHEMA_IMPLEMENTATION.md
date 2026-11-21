# Lab Simulation Schema Implementation

**Task 48: Design lab simulation schema**  
**Requirements:** R27, R31  
**Date:** November 20, 2026

## Summary

Successfully implemented the Lab and LabAttempt models in the Prisma schema to support the government portal simulation feature for the TAXBROS LMS. The schema supports three lab types: GST Registration, Income Tax Return, and MCA Incorporation.

## Changes Made

### 1. Prisma Schema Updates

#### Added LabType Enum
```prisma
enum LabType {
  GST_REGISTRATION
  INCOME_TAX_RETURN
  MCA_INCORPORATION
}
```

#### Added Lab Model
- **Fields:**
  - `id` (UUID, primary key)
  - `type` (LabType enum, unique constraint)
  - `title` (String)
  - `description` (String, optional)
  - `sampleData` (JSON - contains fictional sample data)
  - `isActive` (Boolean, defaults to true)
  - `createdAt` (DateTime)
  - `updatedAt` (DateTime)
  - `createdBy` (String, optional)

- **Relations:**
  - One-to-many with LabAttempt

- **Indexes:**
  - Index on `type`
  - Index on `isActive`

- **Constraints:**
  - Unique constraint on `type` (ensures only one lab per type)

#### Added LabAttempt Model
- **Fields:**
  - `id` (UUID, primary key)
  - `labId` (String, foreign key to Lab)
  - `studentId` (String, foreign key to Student)
  - `formData` (JSON - submitted form data)
  - `result` (JSON - generated results like GSTIN, ARN, CIN)
  - `completedAt` (DateTime, defaults to now)
  - `createdAt` (DateTime)
  - `updatedAt` (DateTime)

- **Relations:**
  - Many-to-one with Lab (cascade delete)
  - Many-to-one with Student (cascade delete)

- **Indexes:**
  - Composite index on `(labId, studentId)` for efficient queries
  - Index on `labId`
  - Index on `studentId`

#### Updated Student Model
- Added `labAttempts` relation to LabAttempt[]

### 2. Database Migration

**Migration:** `20261120070409_add_lab_simulation_schema`

Generated SQL creates:
- LabType enum
- labs table with all fields and indexes
- lab_attempts table with all fields and indexes
- Foreign key constraints with CASCADE delete

### 3. Verification

Created `verify-lab-schema.js` script that validates:
- ✅ LabType enum with 3 correct values
- ✅ Lab model with all required fields
- ✅ LabAttempt model with all required fields
- ✅ Unique constraint on Lab.type
- ✅ Composite index on (labId, studentId)
- ✅ Lab → LabAttempt relationship
- ✅ Student → LabAttempt relationship
- ✅ Cascade delete functionality

All verification tests passed successfully.

## Schema Design Decisions

### 1. JSON Fields for Flexibility
- `sampleData`: Stores fictional data specific to each lab type without requiring type-specific columns
- `formData`: Stores student submissions with varying structures per lab type
- `result`: Stores generated results (GSTIN, ARN, CIN, etc.) flexibly

### 2. Unique Constraint on Lab Type
- Ensures only one lab exists per type (GST, ITR, MCA)
- Simplifies lab retrieval by type
- Prevents accidental duplicate labs

### 3. Composite Index on (labId, studentId)
- Optimizes queries for student attempts in specific labs
- Supports efficient retrieval of attempt history
- Enables fast filtering for progress tracking

### 4. Cascade Delete
- Lab deletion removes all associated attempts
- Student deletion removes all their lab attempts
- Maintains referential integrity

### 5. isActive Flag
- Allows administrators to enable/disable labs
- Supports graceful lab deprecation
- Enables phased lab rollout

## Database Tables Created

### labs
```sql
CREATE TABLE "labs" (
    "id" TEXT NOT NULL,
    "type" "LabType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sampleData" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "labs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "labs_type_key" ON "labs"("type");
CREATE INDEX "labs_type_idx" ON "labs"("type");
CREATE INDEX "labs_isActive_idx" ON "labs"("isActive");
```

### lab_attempts
```sql
CREATE TABLE "lab_attempts" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "formData" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lab_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lab_attempts_labId_studentId_idx" ON "lab_attempts"("labId", "studentId");
CREATE INDEX "lab_attempts_labId_idx" ON "lab_attempts"("labId");
CREATE INDEX "lab_attempts_studentId_idx" ON "lab_attempts"("studentId");
ALTER TABLE "lab_attempts" ADD CONSTRAINT "lab_attempts_labId_fkey" 
    FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE CASCADE;
ALTER TABLE "lab_attempts" ADD CONSTRAINT "lab_attempts_studentId_fkey" 
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE;
```

## Requirements Validation

### Requirement R27: Lab Types
✅ Schema supports all three required lab types:
- GST_REGISTRATION
- INCOME_TAX_RETURN
- MCA_INCORPORATION

### Requirement R31: Sample Data
✅ Schema includes:
- `sampleData` JSON field for fictional lab data
- `formData` JSON field for student submissions
- `result` JSON field for generated outputs

## Next Steps

To complete the lab simulation feature, the following tasks remain:

1. **Task 49:** Create Lab module and service
2. **Task 50:** Implement GST Registration lab logic
3. **Task 51:** Implement Income Tax Return lab logic
4. **Task 52:** Implement MCA Incorporation lab logic
5. **Task 53:** Create lab attempt tracking endpoints
6. **Task 54:** Seed initial lab data

## Files Modified

1. `apps/api/prisma/schema.prisma` - Added Lab and LabAttempt models
2. `apps/api/prisma/migrations/20261120070409_add_lab_simulation_schema/migration.sql` - Generated migration

## Files Created

1. `apps/api/verify-lab-schema.js` - Schema verification script
2. `apps/api/src/lab-schema.spec.ts` - Jest test suite (for future use)
3. `apps/api/LAB_SCHEMA_IMPLEMENTATION.md` - This documentation

## Test Coverage

The lab schema has been verified for:
- Model existence and structure (T6 - Lab structure)
- Enum values and uniqueness
- Field types and constraints
- Relationship mappings
- Index performance
- Cascade delete behavior

## Conclusion

Task 48 has been successfully completed. The lab simulation schema is now ready to support the three government portal simulations with proper data structures, constraints, and relationships. The schema follows best practices for data modeling and supports efficient querying for lab content and student attempt tracking.
