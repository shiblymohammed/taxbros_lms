-- CreateTable
CREATE TABLE "institute_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institute_settings_pkey" PRIMARY KEY ("key")
);

-- Defaults (R6.1)
INSERT INTO "institute_settings" ("key", "value", "updatedAt") VALUES
    ('timezone', 'Asia/Kolkata', CURRENT_TIMESTAMP),
    ('instituteName', 'TaxBros Academy', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
