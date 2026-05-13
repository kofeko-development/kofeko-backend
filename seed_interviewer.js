// Seed interviewer user into the Rajdeep Org tenant (d2bd5703)
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const TARGET_TENANT_ID = 'd2bd5703-b71b-4523-ba59-e0caf536b01d';
const INTERVIEWER_ROLE_ID = 'a0cf66b2-c643-4db4-b992-263803fb1790'; // interviewer in Rajdeep Org

async function main() {
  const email = 'interviewer.rajdeep@kofeko.dev';
  const existing = await prisma.user.findFirst({ where: { tenantId: TARGET_TENANT_ID, email } });
  if (existing) {
    console.log('User already exists:', existing.id);
    const ur = await prisma.userRole.findFirst({ where: { userId: existing.id, roleId: INTERVIEWER_ROLE_ID } });
    if (!ur) {
      await prisma.userRole.create({ data: { tenantId: TARGET_TENANT_ID, userId: existing.id, roleId: INTERVIEWER_ROLE_ID } });
    }
    console.log('Done.');
    return;
  }

  const passwordHash = await bcrypt.hash('Interviewer@123', 10);
  const user = await prisma.user.create({
    data: { tenantId: TARGET_TENANT_ID, firstName: 'Rajdeep', lastName: 'Interviewer', email, passwordHash, status: 'active' }
  });
  await prisma.userRole.create({ data: { tenantId: TARGET_TENANT_ID, userId: user.id, roleId: INTERVIEWER_ROLE_ID } });
  console.log(`✅ Interviewer user created in Rajdeep Org!`);
  console.log(`   Email: ${email}`);
  console.log(`   User ID: ${user.id}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
