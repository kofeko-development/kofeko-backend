import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'itzhimanshu3107@gmail.com';
  const user = await prisma.user.findFirst({
    where: { email },
    include: { userRoles: { include: { role: true } } }
  });
  console.log('User ID:', user?.id);
  console.log('User Roles:', user?.userRoles.map(ur => ur.role.name));
  
  const candidate = await prisma.candidate.findUnique({
    where: { id: user?.id || '' }
  });
  console.log('Candidate ID:', candidate?.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
