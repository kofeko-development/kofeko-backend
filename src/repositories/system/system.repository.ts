import { prisma } from '../../config/prisma';

export const systemRepository = {
  async getSeedStatus() {
    const [tenants, users, roles, permissions, userRoles, rolePermissions, companies] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.userRole.count(),
      prisma.rolePermission.count(),
      prisma.company.count(),
    ]);

    return {
      tenants,
      users,
      roles,
      permissions,
      userRoles,
      rolePermissions,
      companies,
      isSeeded: tenants > 0 && users > 0 && roles > 0 && permissions > 0,
    };
  },
};
