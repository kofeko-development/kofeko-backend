-- AlterTable
ALTER TABLE "public"."User"
ADD COLUMN "otpRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "loginOtpHash" TEXT,
ADD COLUMN "loginOtpExpiresAt" TIMESTAMP(3);
