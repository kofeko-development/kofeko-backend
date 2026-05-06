-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'queued',
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Notification" ADD COLUMN     "type" TEXT NOT NULL;

