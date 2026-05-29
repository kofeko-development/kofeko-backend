-- AlterTable
ALTER TABLE "LinkedInConnection" ADD COLUMN "linkedInEmail" TEXT;
ALTER TABLE "LinkedInConnection" ADD COLUMN "linkedInOrgId" TEXT;
ALTER TABLE "LinkedInConnection" ADD COLUMN "linkedInOrgName" TEXT;
ALTER TABLE "LinkedInConnection" ADD COLUMN "postAsOrg" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LinkedInPost" ADD COLUMN "postedAsOrg" BOOLEAN;
ALTER TABLE "LinkedInPost" ADD COLUMN "postedOrgName" TEXT;
ALTER TABLE "LinkedInPost" ADD COLUMN "postedPersonName" TEXT;
