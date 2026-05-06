-- Manual migration (migrate dev blocked by reset requirement)

-- AlterTable
ALTER TABLE "public"."Pipeline" ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "slaDeadline" TIMESTAMP(3);

