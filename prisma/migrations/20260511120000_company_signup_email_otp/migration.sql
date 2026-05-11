-- Drop any drifted table (e.g. from `db push` without codeHash), then create canonical shape.
DROP TABLE IF EXISTS "CompanySignupEmailOtp";

-- CreateTable
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

-- CreateIndex
CREATE INDEX "CompanySignupEmailOtp_email_idx" ON "CompanySignupEmailOtp"("email");
