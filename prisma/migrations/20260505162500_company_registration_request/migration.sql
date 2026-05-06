-- CreateEnum
CREATE TYPE "public"."CompanyRegistrationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "public"."CompanyRegistrationRequest" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyAddress" JSONB NOT NULL,
    "industry" TEXT NOT NULL,
    "companySize" TEXT NOT NULL,
    "companyType" "public"."CompanyType" NOT NULL,
    "foundedYear" INTEGER NOT NULL,
    "companyWebsite" TEXT NOT NULL,
    "officialCompanyAddress" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "companyLogo" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "twitterUrl" TEXT,
    "termsAccepted" BOOLEAN NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "status" "public"."CompanyRegistrationStatus" NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "approvedTenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyRegistrationRequest_pkey" PRIMARY KEY ("id")
);
