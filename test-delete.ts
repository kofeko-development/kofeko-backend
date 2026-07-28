import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const requests = await prisma.companyRegistrationRequest.findMany({
    where: { status: 'approved', approvedTenantId: { not: null } }
  });
  let deletedCount = 0;
  for (const req of requests) {
    if (req.approvedTenantId) {
      const tenantExists = await prisma.tenant.findUnique({ where: { id: req.approvedTenantId } });
      if (!tenantExists) {
        console.log(`Deleting orphaned request for ${req.companyName} (Tenant ${req.approvedTenantId} missing)`);
        await prisma.companyRegistrationRequest.delete({ where: { id: req.id } });
        deletedCount++;
      }
    }
  }
  console.log(`Deleted ${deletedCount} orphaned requests.`);
}
main().finally(() => prisma.$disconnect());
