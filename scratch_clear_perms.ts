import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenantId = '9bfd31c5-5a0f-4adc-9046-490f63fac24b'; // Kofeko Candidates
  const roleName = 'candidate';
  
  const role = await prisma.role.findFirst({
    where: { tenantId, name: roleName }
  });
  
  if (role) {
    const deleted = await prisma.rolePermission.deleteMany({
      where: { roleId: role.id }
    });
    console.log(`Deleted ${deleted.count} permissions for role ${roleName} in tenant ${tenantId}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
