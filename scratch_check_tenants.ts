import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: ['9bfd31c5-5a0f-4adc-9046-490f63fac24b', 'c4950e56-563b-4b78-a1b0-a5e9dea25313'] } },
    select: { id: true, name: true, slug: true }
  });
  console.log(JSON.stringify(tenants, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
