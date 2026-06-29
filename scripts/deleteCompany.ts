import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Please provide the company admin or contact email. Usage: npx ts-node scripts/deleteCompany.ts admin@company.com');
    process.exit(1);
  }

  console.log(`Searching for company/tenant associated with email: ${email}`);

  // Find Tenant from User table
  const user = await prisma.user.findFirst({
    where: { email },
    include: { tenant: true },
  });

  let tenantId: string | null = null;
  let companyId: string | null = null;

  if (user) {
    tenantId = user.tenantId;
    companyId = user.tenant.companyId;
  } else {
    // Try finding via CompanyRegistrationRequest
    const registration = await prisma.companyRegistrationRequest.findFirst({
      where: {
        OR: [
          { contactEmail: email },
          { adminEmail: email }
        ]
      }
    });

    if (registration) {
      tenantId = registration.approvedTenantId;
      if (tenantId) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId }
        });
        companyId = tenant?.companyId || null;
      }
    }
  }

  if (!tenantId) {
    console.log(`Could not find any company/tenant associated with email: ${email}`);
    process.exit(0);
  }

  console.log(`Found tenant ${tenantId} and company ${companyId}. Starting cleanup...`);

  // Perform inside transaction to ensure atomicity and handle foreign keys
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { tenantId } }),
    prisma.metric.deleteMany({ where: { tenantId } }),
    prisma.message.deleteMany({ where: { tenantId } }),
    prisma.notification.deleteMany({ where: { tenantId } }),
    prisma.evaluation.deleteMany({ where: { tenantId } }),
    prisma.pipeline.deleteMany({ where: { tenantId } }),
    prisma.candidate.deleteMany({ where: { tenantId } }),
    prisma.linkedInPost.deleteMany({ where: { tenantId } }),
    prisma.linkedInConnection.deleteMany({ where: { tenantId } }),
    prisma.job.deleteMany({ where: { tenantId } }),
    prisma.session.deleteMany({ where: { tenantId } }),
    prisma.userRole.deleteMany({ where: { tenantId } }),
    prisma.rolePermission.deleteMany({ where: { tenantId } }),
    prisma.permission.deleteMany({ where: { tenantId } }),
    prisma.role.deleteMany({ where: { tenantId } }),
    prisma.inviteToken.deleteMany({ where: { tenantId } }),
    prisma.passwordResetToken.deleteMany({ where: { tenantId } }),
    prisma.user.deleteMany({ where: { tenantId } }),
  ]);

  console.log('Cleared all associated logs, metrics, jobs, candidates, user roles, and users.');

  // Disconnect company from tenant
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { companyId: null },
  });

  // Delete Tenant
  await prisma.tenant.delete({
    where: { id: tenantId },
  });
  console.log(`Deleted tenant record ${tenantId}.`);

  // Delete Company
  if (companyId) {
    await prisma.company.delete({
      where: { id: companyId },
    });
    console.log(`Deleted company record ${companyId}.`);
  }

  // Delete Company Registration Requests matching email or tenant
  const registrationDeleted = await prisma.companyRegistrationRequest.deleteMany({
    where: {
      OR: [
        { approvedTenantId: tenantId },
        { contactEmail: email },
        { adminEmail: email }
      ]
    }
  });
  console.log(`Deleted ${registrationDeleted.count} registration request(s).`);

  console.log(`Company and all related data for ${email} successfully deleted.`);
}

main()
  .catch((e) => {
    console.error('Error deleting company data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
