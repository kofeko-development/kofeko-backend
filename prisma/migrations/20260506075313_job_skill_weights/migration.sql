-- CreateEnum
CREATE TYPE "public"."HiringPriority" AS ENUM ('high', 'medium', 'low');

-- AlterTable
ALTER TABLE "public"."Job" ADD COLUMN     "department" TEXT,
ADD COLUMN     "experienceMax" INTEGER,
ADD COLUMN     "experienceMin" INTEGER,
ADD COLUMN     "hiringPriority" "public"."HiringPriority",
ADD COLUMN     "niceToHave" TEXT,
ADD COLUMN     "requirements" TEXT,
ADD COLUMN     "screeningQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "skillWeights" JSONB;
