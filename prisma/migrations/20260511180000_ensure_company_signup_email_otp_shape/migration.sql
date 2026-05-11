-- Fix databases where CompanySignupEmailOtp existed without Prisma-expected columns (e.g. drift from db push).
-- Only stores short-lived OTP rows; safe to recreate.

DROP TABLE IF EXISTS "CompanySignupEmailOtp";

CREATE TABLE "CompanySignupEmailOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanySignupEmailOtp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanySignupEmailOtp_email_idx" ON "CompanySignupEmailOtp"("email");
