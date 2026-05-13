import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const candidate = await prisma.candidate.upsert({
    where: { id: '983a71ba-9109-4c94-a7e7-7ea9be4382cd' },
    update: {},
    create: {
      id: '983a71ba-9109-4c94-a7e7-7ea9be4382cd',
      tenantId: '9bfd31c5-5a0f-4adc-9046-490f63fac24b',
      email: 'itzhimanshu3107@gmail.com',
      firstName: 'Himanshu',
      lastName: 'Vaghela',
      status: 'new',
    }
  });
  console.log('Candidate record ensured:', JSON.stringify(candidate, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
