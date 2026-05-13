import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'itzhimanshu3107@gmail.com' },
    include: { userRoles: { include: { role: true } } }
  });
  console.log('Roles:', user?.userRoles.map(ur => ur.role.name));
}

main().catch(console.error).finally(() => prisma.$disconnect());
