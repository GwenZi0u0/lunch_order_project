ALTER TABLE "MenuItem"
ADD COLUMN IF NOT EXISTS "customizationSettingTitle" TEXT,
ADD COLUMN IF NOT EXISTS "requiredCustomizationOptions" TEXT,
ADD COLUMN IF NOT EXISTS "requiredCustomizationOptionGroups" TEXT;
