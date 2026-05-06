-- AlterTable
ALTER TABLE "public"."Evaluation" ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parsedResumeData" JSONB,
ADD COLUMN     "rankingSummary" TEXT,
ADD COLUMN     "roleFitNotes" TEXT,
ADD COLUMN     "sectionScores" JSONB,
ADD COLUMN     "skillMatches" JSONB;

