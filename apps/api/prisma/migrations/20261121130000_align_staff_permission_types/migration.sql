-- Align staff permission types with R3.2:
-- MARK_ATTENDANCE, VIEW_REPORTS, MANAGE_COURSES, MANAGE_STUDENTS, MANAGE_STAFF, MANAGE_CLASSES
-- (MANAGE_LABS is kept as an extra). MANAGE_USERS is split into MANAGE_STUDENTS and MANAGE_STAFF.

ALTER TABLE "staff_permissions" ALTER COLUMN "permission" TYPE TEXT;

-- Each MANAGE_USERS grant also becomes a MANAGE_STAFF grant (same granter and time)
INSERT INTO "staff_permissions" ("id", "staffId", "permission", "grantedBy", "grantedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "staffId", 'MANAGE_STAFF', "grantedBy", "grantedAt", "createdAt", CURRENT_TIMESTAMP
FROM "staff_permissions"
WHERE "permission" = 'MANAGE_USERS'
ON CONFLICT ("staffId", "permission") DO NOTHING;

-- ...and the original row becomes MANAGE_STUDENTS
UPDATE "staff_permissions" SET "permission" = 'MANAGE_STUDENTS', "updatedAt" = CURRENT_TIMESTAMP
WHERE "permission" = 'MANAGE_USERS';

DROP TYPE "StaffPermissionType";
CREATE TYPE "StaffPermissionType" AS ENUM (
  'MARK_ATTENDANCE',
  'VIEW_REPORTS',
  'MANAGE_COURSES',
  'MANAGE_STUDENTS',
  'MANAGE_STAFF',
  'MANAGE_CLASSES',
  'MANAGE_LABS'
);

ALTER TABLE "staff_permissions"
  ALTER COLUMN "permission" TYPE "StaffPermissionType" USING "permission"::"StaffPermissionType";
