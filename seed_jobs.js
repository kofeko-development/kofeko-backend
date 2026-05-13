// Seed: Create an open job + a draft job in Rajdeep Org for Module 5 testing
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const TENANT_ID = 'd2bd5703-b71b-4523-ba59-e0caf536b01d';

async function main() {
  const openJob = await db.job.create({
    data: {
      tenantId: TENANT_ID,
      title: 'Senior Frontend Developer',
      description: 'We are looking for a passionate Senior Frontend Developer to join our team at Kofeko. You will build next-generation hiring UIs using React and TypeScript.',
      location: 'Remote — India',
      employmentType: 'Full-time',
      department: 'Engineering',
      status: 'open',
      openings: 2,
      requirements: '5+ years React experience, TypeScript, Next.js, strong UI/UX sensibility',
      skillWeights: [
        { skill: 'React', weight: 10 },
        { skill: 'TypeScript', weight: 9 },
        { skill: 'Next.js', weight: 8 },
        { skill: 'Node.js', weight: 6 },
      ],
      hiringPriority: 'high',
    }
  });

  const draftJob = await db.job.create({
    data: {
      tenantId: TENANT_ID,
      title: 'Backend Engineer (Draft)',
      description: 'Draft job for testing purposes.',
      status: 'draft',
      openings: 1,
    }
  });

  console.log('✅ Open job created:');
  console.log('  ID:', openJob.id);
  console.log('  Title:', openJob.title);
  console.log('  Status:', openJob.status);
  console.log('\n✅ Draft job created:');
  console.log('  ID:', draftJob.id);
  console.log('  Title:', draftJob.title);
}

main().catch(console.error).finally(() => db.$disconnect());
