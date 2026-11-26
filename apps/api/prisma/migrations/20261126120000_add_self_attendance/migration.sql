-- Self attendance: students check in with a rotating class QR code, staff check in/out
-- on the institute network or at its location. Additive only.

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('MARKED', 'SELF_QR', 'SELF_CHECK_IN');

-- AlterTable
ALTER TABLE "student_attendance_registers"
    ADD COLUMN "selfCheckInSecret" TEXT,
    ADD COLUMN "selfCheckInOpenedAt" TIMESTAMP(3),
    ADD COLUMN "selfCheckInClosedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "student_attendance"
    ADD COLUMN "source" "AttendanceSource" NOT NULL DEFAULT 'MARKED';

-- AlterTable
ALTER TABLE "staff_attendance"
    ADD COLUMN "source" "AttendanceSource" NOT NULL DEFAULT 'MARKED',
    ADD COLUMN "checkInAt" TIMESTAMP(3),
    ADD COLUMN "checkOutAt" TIMESTAMP(3),
    ADD COLUMN "checkInVia" TEXT;
