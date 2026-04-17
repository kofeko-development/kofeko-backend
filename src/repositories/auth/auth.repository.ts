import { Permission, Tenant, User, UserStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { DEFAULT_ROLE_PERMISSION_MATRIX } from '../../common/constants/rolePermissionMatrix';
import { ROLE_NAMES } from '../../common/constants/roles';

type BootstrapTenantAdminInput = {
  tenantName: string;
  tenantSlug: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  permissionKeys: string[];
};

export const authRepository = {
  async bootstrapTenantAdmin(input: BootstrapTenantAdminInput): Promise<{ tenant: Tenant; user: User; permissions: Permission[] }> {
    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.tenantName,
          slug: input.tenantSlug,
        },
      });

      await tx.permission.createMany({
        data: input.permissionKeys.map((key) => ({
          tenantId: tenant.id,
          key,
        })),
      });

      const permissions = await tx.permission.findMany({
        where: { tenantId: tenant.id },
      });

      const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission]));

      const roleByName = new Map<string, string>();

      for (const [roleName, rolePermissions] of Object.entries(DEFAULT_ROLE_PERMISSION_MATRIX)) {
        const role = await tx.role.upsert({
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

        roleByName.set(roleName, role.id);

        const rolePermissionRows = rolePermissions
          .map((permissionKey) => permissionByKey.get(permissionKey))
          .filter((permission): permission is Permission => Boolean(permission))
          .map((permission) => ({
            tenantId: tenant.id,
            roleId: role.id,
            permissionId: permission.id,
          }));

        if (rolePermissionRows.length > 0) {
          await tx.rolePermission.createMany({
            data: rolePermissionRows,
            skipDuplicates: true,
          });
        }
      }

      const companyAdminRoleId = roleByName.get(ROLE_NAMES.COMPANY_ADMIN);

      if (!companyAdminRoleId) {
        throw new Error('Default company_admin role was not created during tenant bootstrap');
      }

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          passwordHash: input.passwordHash,
          status: UserStatus.active,
        },
      });

      await tx.userRole.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: companyAdminRoleId,
        },
      });

      return { tenant, user, permissions };
    });
  },

  async findUserByTenantSlugAndEmail(tenantSlug: string, email: string): Promise<(User & { tenant: Tenant }) | null> {
    return prisma.user.findFirst({
      where: {
        email,
        tenant: {
          slug: tenantSlug,
        },
      },
      include: {
        tenant: true,
      },
    });
  },

  async findUserById(id: string): Promise<(User & { tenant: Tenant }) | null> {
    return prisma.user.findUnique({
      where: { id },
      include: { tenant: true },
    });
  },

  async createSession(data: {
    tenantId: string;
    userId: string;
    refreshTokenHash: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }) {
    return prisma.session.create({ data });
  },

  async findValidSession(userId: string, tenantId: string, refreshTokenHash: string) {
    return prisma.session.findFirst({
      where: {
        userId,
        tenantId,
        refreshTokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  },

  async revokeSession(id: string) {
    return prisma.session.update({
      where: { id },
      data: {
        revokedAt: new Date(),
      },
    });
  },
};
