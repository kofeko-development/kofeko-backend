import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../common/auth/password';
import { PERMISSIONS } from '../common/constants/permissions';
import { DEFAULT_ROLE_PERMISSION_MATRIX } from '../common/constants/rolePermissionMatrix';
import { ROLE_NAMES } from '../common/constants/roles';

const prisma = new PrismaClient();

const bootstrapConfig = {
  enabled: process.env.SEED_BOOTSTRAP_ENABLED !== 'false',
  tenantName: process.env.SEED_TENANT_NAME ?? 'Demo Tenant',
  tenantSlug: process.env.SEED_TENANT_SLUG ?? 'demo-tenant',
  adminFirstName: process.env.SEED_ADMIN_FIRST_NAME ?? 'Platform',
  adminLastName: process.env.SEED_ADMIN_LAST_NAME ?? 'Admin',
  adminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@demo.com',
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345',
};

async function bootstrapTenantAdminIfEmpty(): Promise<void> {
  if (!bootstrapConfig.enabled) {
    return;
  }

  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: bootstrapConfig.tenantSlug },
  });

  if (existingTenant) {
    return;
  }

  const passwordHash = await hashPassword(bootstrapConfig.adminPassword);

  const tenant = await prisma.tenant.create({
    data: {
      name: bootstrapConfig.tenantName,
      slug: bootstrapConfig.tenantSlug,
    },
  });

  const companyAdminRole = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: ROLE_NAMES.COMPANY_ADMIN,
      description: 'Default company administrator role',
    },
  });

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: bootstrapConfig.adminFirstName,
      lastName: bootstrapConfig.adminLastName,
      email: bootstrapConfig.adminEmail,
      passwordHash,
    },
  });

  await prisma.userRole.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      roleId: companyAdminRole.id,
    },
  });

}

async function bootstrapSuperAdminIfEmpty(): Promise<void> {
  if (!bootstrapConfig.enabled) {
    return;
  }

  const email = process.env.SEED_SUPERADMIN_EMAIL ?? 'devops@kofeko.com';
  const passwordHash = await hashPassword(bootstrapConfig.adminPassword);

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
  console.log('Seeded/Updated SuperAdmin');
}

async function seedTenantPermissionsAndAdminRole(): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    select: { id: true },
  });

  for (const tenant of tenants) {
    await prisma.permission.createMany({
      data: Object.values(PERMISSIONS).map((key) => ({
        tenantId: tenant.id,
        key,
      })),
      skipDuplicates: true,
    });

    const permissions = await prisma.permission.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, key: true },
    });

    const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission]));

    for (const [roleName, rolePermissions] of Object.entries(DEFAULT_ROLE_PERMISSION_MATRIX)) {
      const role = await prisma.role.upsert({
        where: {
          tenantId_name: {
            tenantId: tenant.id,
            name: roleName,
          },
        },
        update: {
          description: `Default ${roleName.replace('_', ' ')} role`,
        },
        create: {
          tenantId: tenant.id,
          name: roleName,
          description: `Default ${roleName.replace('_', ' ')} role`,
        },
      });

      const rolePermissionRows = rolePermissions
        .map((permissionKey) => permissionByKey.get(permissionKey))
        .filter((permission): permission is { id: string; key: string } => Boolean(permission))
        .map((permission) => ({
          tenantId: tenant.id,
          roleId: role.id,
          permissionId: permission.id,
        }));

      if (rolePermissionRows.length > 0) {
        await prisma.rolePermission.createMany({
          data: rolePermissionRows,
          skipDuplicates: true,
        });
      }
    }
  }
}

async function main(): Promise<void> {
  await bootstrapSuperAdminIfEmpty();
  await bootstrapTenantAdminIfEmpty();
  await seedTenantPermissionsAndAdminRole();
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
