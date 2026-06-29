import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Please provide a candidate email address. Usage: npx ts-node scripts/deleteCandidate.ts candidate@example.com');
    process.exit(1);
  }

  console.log(`Searching for candidate records with email: ${email}`);

  const candidates = await prisma.candidate.findMany({
    where: { email },
  });

  if (candidates.length === 0) {
    console.log(`No candidate found with email: ${email}`);
    process.exit(0);
  }

  const candidateIds = candidates.map((c) => c.id);
  console.log(`Found ${candidates.length} candidate record(s) across tenants (IDs: ${candidateIds.join(', ')}).`);

  // 1. Delete evaluations associated with the candidate(s)
  const evaluationsDeleted = await prisma.evaluation.deleteMany({
    where: { candidateId: { in: candidateIds } },
  });
  console.log(`Deleted ${evaluationsDeleted.count} evaluation record(s).`);

  // 2. Delete pipeline applications associated with the candidate(s)
  const pipelinesDeleted = await prisma.pipeline.deleteMany({
    where: { candidateId: { in: candidateIds } },
  });
  console.log(`Deleted ${pipelinesDeleted.count} pipeline application record(s).`);

  // 3. Delete candidate records
  const candidatesDeleted = await prisma.candidate.deleteMany({
    where: { id: { in: candidateIds } },
  });
  console.log(`Deleted ${candidatesDeleted.count} candidate profile record(s).`);

  console.log(`Candidate ${email} and all related data successfully deleted.`);
}

main()
  .catch((e) => {
    console.error('Error deleting candidate:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
