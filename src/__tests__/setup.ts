import { prisma } from '../config/prisma';

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  // Clear in dependency order.
  await prisma.auditLog.deleteMany();
  await prisma.superAdminSession.deleteMany();
  await prisma.superAdmin.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.job.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.companyRegistrationRequest.deleteMany();
  await prisma.companySignupEmailOtp.deleteMany();
  await prisma.inviteToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.tenant.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
