-- R27.4: record who last changed a lab's sample data (the update time is "updatedAt")
ALTER TABLE "labs" ADD COLUMN "updatedBy" TEXT;
