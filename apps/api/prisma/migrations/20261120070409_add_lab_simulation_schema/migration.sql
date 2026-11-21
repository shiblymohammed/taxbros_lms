-- CreateEnum
CREATE TYPE "LabType" AS ENUM ('GST_REGISTRATION', 'INCOME_TAX_RETURN', 'MCA_INCORPORATION');

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "labs_type_key" ON "labs"("type");

-- CreateIndex
CREATE INDEX "labs_type_idx" ON "labs"("type");

-- CreateIndex
CREATE INDEX "labs_isActive_idx" ON "labs"("isActive");

-- CreateIndex
CREATE INDEX "lab_attempts_labId_studentId_idx" ON "lab_attempts"("labId", "studentId");

-- CreateIndex
CREATE INDEX "lab_attempts_labId_idx" ON "lab_attempts"("labId");

-- CreateIndex
CREATE INDEX "lab_attempts_studentId_idx" ON "lab_attempts"("studentId");

-- AddForeignKey
ALTER TABLE "lab_attempts" ADD CONSTRAINT "lab_attempts_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_attempts" ADD CONSTRAINT "lab_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
