import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- SuperAdmins ---');
  const superAdmins = await prisma.superAdmin.findMany();
  console.log(JSON.stringify(superAdmins, null, 2));

  console.log('\n--- Tenants ---');
  const tenants = await prisma.tenant.findMany();
  console.log(JSON.stringify(tenants, null, 2));

  console.log('\n--- Users (First 10) ---');
  const users = await prisma.user.findMany({
    take: 10,
    include: {
      tenant: true
    }
  });
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
