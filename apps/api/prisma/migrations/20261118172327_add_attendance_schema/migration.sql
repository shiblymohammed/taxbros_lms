-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE');

-- CreateEnum
CREATE TYPE "RegisterStatus" AS ENUM ('DRAFT', 'SAVED');

-- CreateTable
CREATE TABLE "student_attendance_registers" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "rosterSnapshot" JSONB NOT NULL,
    "status" "RegisterStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_attendance_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_attendance" (
    "id" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "remarks" TEXT,
    "markedBy" TEXT NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_attendance" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "remarks" TEXT,
    "markedBy" TEXT NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_attendance_registers_classId_attendanceDate_idx" ON "student_attendance_registers"("classId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_registers_classId_attendanceDate_key" ON "student_attendance_registers"("classId", "attendanceDate");

-- CreateIndex
CREATE INDEX "student_attendance_registerId_idx" ON "student_attendance"("registerId");

-- CreateIndex
CREATE INDEX "student_attendance_studentId_idx" ON "student_attendance"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_registerId_studentId_key" ON "student_attendance"("registerId", "studentId");

-- CreateIndex
CREATE INDEX "staff_attendance_staffId_idx" ON "staff_attendance"("staffId");

-- CreateIndex
CREATE INDEX "staff_attendance_attendanceDate_idx" ON "staff_attendance"("attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "staff_attendance_staffId_attendanceDate_key" ON "staff_attendance"("staffId", "attendanceDate");

-- AddForeignKey
ALTER TABLE "student_attendance_registers" ADD CONSTRAINT "student_attendance_registers_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "student_attendance_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
