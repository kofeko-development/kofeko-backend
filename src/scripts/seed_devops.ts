import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../common/auth/password';

const prisma = new PrismaClient();

async function main() {
  const email = 'devops@kofeko.com';
  const password = 'Admin@12345';
  const passwordHash = await hashPassword(password);

  // 1. Create or update SuperAdmin
  await prisma.superAdmin.upsert({
    where: { email },
    update: {
      passwordHash,
    },
    create: {
      email,
      firstName: 'DevOps',
      lastName: 'Admin',
      passwordHash,
    },

  });
  console.log('Seeded/Updated SuperAdmin with email:', email);

  // 2. Create or update User in demo-tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'demo-tenant' },
  });

  if (tenant) {
    const user = await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email,
        },
      },
      update: {
        passwordHash,
      },
      create: {
        tenantId: tenant.id,
        firstName: 'DevOps',
        lastName: 'Admin',
        email,
        passwordHash,
        status: 'active',
      },
    });

    // Assign company admin role
    const companyAdminRole = await prisma.role.findFirst({
      where: { tenantId: tenant.id, name: 'company_admin' },
    });

    if (companyAdminRole) {
      await prisma.userRole.upsert({
        where: {
          tenantId_userId_roleId: {
            userId: user.id,
            roleId: companyAdminRole.id,
            tenantId: tenant.id,
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: companyAdminRole.id,
        },
      });
      console.log('Assigned company_admin role to DevOps User in demo-tenant');
    }
  } else {
    console.log('demo-tenant not found, skipping regular user seed for', email);
  }
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
