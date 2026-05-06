-- This migration is created manually because prisma migrate dev is not available
-- in non-interactive environments when enum values are removed.

-- CandidateStatus enum swap (exact Postgres-safe order)
-- 1. Cast column to text (breaks enum dependency)
ALTER TABLE "public"."Candidate" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Candidate" ALTER COLUMN "status" TYPE TEXT;

-- 2. Remap old values to new ones
UPDATE "public"."Candidate" SET "status" = 'screening' WHERE "status" = 'screened';
UPDATE "public"."Candidate" SET "status" = 'interview' WHERE "status" = 'shortlisted';

-- 3. Drop old enum
DROP TYPE "public"."CandidateStatus";

-- 4. Create new enum
CREATE TYPE "public"."CandidateStatus" AS ENUM ('new', 'screening', 'interview', 'offer', 'hired', 'rejected');

-- 5. Cast column back to new enum
ALTER TABLE "public"."Candidate"
  ALTER COLUMN "status" TYPE "public"."CandidateStatus"
  USING "status"::"public"."CandidateStatus";

-- Restore default
ALTER TABLE "public"."Candidate" ALTER COLUMN "status" SET DEFAULT 'new';

-- AlterTable
ALTER TABLE "public"."Candidate" ADD COLUMN     "expectedSalary" DOUBLE PRECISION,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "noticePeriod" INTEGER,
ADD COLUMN     "portfolioUrl" TEXT,
ADD COLUMN     "resumeMimeType" TEXT,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "source" TEXT;

