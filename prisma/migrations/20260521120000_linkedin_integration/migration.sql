-- CreateEnum
CREATE TYPE "public"."LinkedInPostStatus" AS ENUM ('generated', 'shared', 'published', 'failed');

-- AlterEnum
ALTER TYPE "public"."AuditActionType" ADD VALUE 'linkedin_copy';
ALTER TYPE "public"."AuditActionType" ADD VALUE 'linkedin_share_opened';
ALTER TYPE "public"."AuditActionType" ADD VALUE 'linkedin_connect';
ALTER TYPE "public"."AuditActionType" ADD VALUE 'linkedin_disconnect';
ALTER TYPE "public"."AuditActionType" ADD VALUE 'linkedin_post';

-- CreateTable
CREATE TABLE "public"."LinkedInConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedInPersonId" TEXT,
    "linkedInName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "accessTokenExpiry" TIMESTAMP(3),
    "scope" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LinkedInPost" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "postedByUserId" TEXT NOT NULL,
    "linkedInPostId" TEXT,
    "postUrl" TEXT,
    "shareUrl" TEXT,
    "postText" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "status" "public"."LinkedInPostStatus" NOT NULL DEFAULT 'generated',
    "errorMessage" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkedInConnection_userId_key" ON "public"."LinkedInConnection"("userId");

-- AddForeignKey
ALTER TABLE "public"."LinkedInConnection" ADD CONSTRAINT "LinkedInConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LinkedInConnection" ADD CONSTRAINT "LinkedInConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LinkedInPost" ADD CONSTRAINT "LinkedInPost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LinkedInPost" ADD CONSTRAINT "LinkedInPost_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LinkedInPost" ADD CONSTRAINT "LinkedInPost_postedByUserId_fkey" FOREIGN KEY ("postedByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
