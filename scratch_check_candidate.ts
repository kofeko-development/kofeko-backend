import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.candidate.findMany({
    where: { email: 'itzhimanshu3107@gmail.com' },
    select: { id: true, tenantId: true, email: true }
  });
  console.log(JSON.stringify(candidates, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
