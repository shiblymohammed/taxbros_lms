-- CreateEnum
CREATE TYPE "StaffPermissionType" AS ENUM ('MARK_ATTENDANCE', 'VIEW_REPORTS', 'MANAGE_COURSES', 'MANAGE_LABS', 'MANAGE_USERS');

-- CreateTable
CREATE TABLE "staff_permissions" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "permission" "StaffPermissionType" NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_permissions_staffId_idx" ON "staff_permissions"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_permissions_staffId_permission_key" ON "staff_permissions"("staffId", "permission");

-- CreateIndex
CREATE INDEX "staff_department_idx" ON "staff"("department");

-- CreateIndex
CREATE INDEX "staff_category_idx" ON "staff"("category");

-- AddForeignKey
ALTER TABLE "staff_permissions" ADD CONSTRAINT "staff_permissions_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
