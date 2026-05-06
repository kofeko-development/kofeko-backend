import { prisma } from '../config/prisma';

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  // Clear in dependency order.
  await prisma.auditLog.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.inviteToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.company.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
