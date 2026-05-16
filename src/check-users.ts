import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, firstName: true, lastName: true, tenant: { select: { slug: true } } }
  });
  console.log('--- Staff Users ---');
  console.table(users);

  const superAdmins = await prisma.superAdmin.findMany({
    select: { email: true, firstName: true }
  });
  console.log('\n--- Super Admins ---');
  console.table(superAdmins);

  const candidates = await prisma.candidate.findMany({
    select: { email: true, firstName: true, tenant: { select: { slug: true } } }
  });
  console.log('\n--- Candidates ---');
  console.table(candidates);
}

main().finally(() => prisma.$disconnect());
