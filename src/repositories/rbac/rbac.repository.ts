import { Permission, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AssignRoleToUserInput, AttachPermissionToRoleInput, CreatePermissionInput, CreateRoleInput } from '../../types/rbac/rbac.types';

export const rbacRepository = {
  async createRole(data: CreateRoleInput): Promise<Role> {
    return prisma.role.create({ data });
  },

  async createPermission(data: CreatePermissionInput): Promise<Permission> {
    return prisma.permission.create({ data });
  },

  async assignRoleToUser(data: AssignRoleToUserInput) {
    return prisma.userRole.create({ data });
  },

  async attachPermissionToRole(data: AttachPermissionToRoleInput) {
    return prisma.rolePermission.create({ data });
  },

  async getRoleById(id: string) {
    return prisma.role.findUnique({ where: { id } });
  },

  async getPermissionById(id: string) {
    return prisma.permission.findUnique({ where: { id } });
  },

  async getUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async getUserPermissions(tenantId: string, userId: string): Promise<string[]> {
    const mappings = await prisma.userRole.findMany({
      where: { tenantId, userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissions = new Set(
      mappings.flatMap((mapping) => mapping.role.rolePermissions.map((item) => item.permission.key)),
    );

    return Array.from(permissions);
  },
};
