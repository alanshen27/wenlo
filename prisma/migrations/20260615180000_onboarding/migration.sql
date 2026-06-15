-- AlterTable
ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- Existing accounts skip first-run onboarding.
UPDATE "User" SET "onboardingCompletedAt" = NOW() WHERE "onboardingCompletedAt" IS NULL;
