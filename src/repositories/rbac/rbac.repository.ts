import { Permission, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AssignRoleToUserInput, AttachPermissionToRoleInput, CreatePermissionInput, CreateRoleInput } from '../../types/rbac/rbac.types';

export const rbacRepository = {
  async createRole(data: CreateRoleInput): Promise<Role> {
    return prisma.$transaction(async (tx) => {
      const { permissionKeys, ...roleData } = data;
      const role = await tx.role.create({ data: roleData });
      
      if (permissionKeys && permissionKeys.length > 0) {
        const permissions = await tx.permission.findMany({
          where: { tenantId: data.tenantId, key: { in: permissionKeys } },
        });

        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map(p => ({
              tenantId: data.tenantId,
              roleId: role.id,
              permissionId: p.id,
            })),
          });
        }
      }
      return role;
    });
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

  async getRoleById(tenantId: string, id: string) {
    return prisma.role.findUnique({ where: { id, tenantId } });
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

  async getRoles(tenantId: string) {
    return prisma.role.findMany({
      where: { tenantId },
      include: {
        rolePermissions: {
          include: {
            permission: {
              select: { key: true }
            }
          }
        }
      }
    });
  },

  async updateRole(tenantId: string, roleId: string, name: string, description: string | undefined, permissionKeys: string[]) {
    return prisma.$transaction(async (tx) => {
      // 1. Update role basics
      const role = await tx.role.update({
        where: { id: roleId },
        data: { name, description },
      });

      // 2. Clear existing role permissions
      await tx.rolePermission.deleteMany({
        where: { roleId, tenantId },
      });

      // 3. Find permission IDs for the provided keys
      const permissions = await tx.permission.findMany({
        where: { tenantId, key: { in: permissionKeys } },
      });

      // 4. Create new role permissions
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map(p => ({
            tenantId,
            roleId,
            permissionId: p.id,
          })),
        });
      }

      return role;
    });
  },

  async deleteRole(tenantId: string, roleId: string) {
    return prisma.role.delete({
      where: { id: roleId, tenantId },
    });
  },
};
