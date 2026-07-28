import { Permission, Role } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { rbacRepository } from '../../repositories/rbac/rbac.repository';
import { AssignRoleToUserInput, AttachPermissionToRoleInput, CreatePermissionInput, CreateRoleInput } from '../../types/rbac/rbac.types';
import { cacheService } from '../../common/cache/cacheService';

export const rbacService = {
  async createRole(payload: CreateRoleInput): Promise<Role> {
    return rbacRepository.createRole(payload);
  },

  async createPermission(payload: CreatePermissionInput): Promise<Permission> {
    return rbacRepository.createPermission(payload);
  },

  async attachPermissionToRole(payload: AttachPermissionToRoleInput) {
    const role = await rbacRepository.getRoleById(payload.tenantId, payload.roleId);
    const permission = await rbacRepository.getPermissionById(payload.permissionId);

    if (!role || role.tenantId !== payload.tenantId) {
      throw new AppError('Role not found in tenant', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    if (!permission || permission.tenantId !== payload.tenantId) {
      throw new AppError('Permission not found in tenant', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return rbacRepository.attachPermissionToRole(payload);
  },

  async assignRoleToUser(payload: AssignRoleToUserInput) {
    const role = await rbacRepository.getRoleById(payload.tenantId, payload.roleId);
    const user = await rbacRepository.getUserById(payload.userId);

    if (!role || role.tenantId !== payload.tenantId) {
      throw new AppError('Role not found in tenant', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    if (!user || user.tenantId !== payload.tenantId) {
      throw new AppError('User not found in tenant', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const result = await rbacRepository.assignRoleToUser(payload);
    await cacheService.invalidateStaffSession(payload.tenantId, payload.userId);
    return result;
  },

  async getUserPermissions(tenantId: string, userId: string): Promise<string[]> {
    const user = await rbacRepository.getUserById(userId);

    if (!user || user.tenantId !== tenantId) {
      throw new AppError('User not found in tenant', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return rbacRepository.getUserPermissions(tenantId, userId);
  },

  async getRoles(tenantId: string) {
    return rbacRepository.getRoles(tenantId);
  },

  async updateRole(tenantId: string, roleId: string, name: string, description: string | undefined, permissionKeys: string[]) {
    const role = await rbacRepository.getRoleById(tenantId, roleId);
    if (!role || role.tenantId !== tenantId) {
      throw new AppError('Role not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return rbacRepository.updateRole(tenantId, roleId, name, description, permissionKeys);
  },

  async deleteRole(tenantId: string, roleId: string) {
    const role = await rbacRepository.getRoleById(tenantId, roleId);
    if (!role || role.tenantId !== tenantId) {
      throw new AppError('Role not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    // Prevent deletion of company_admin role if needed, but for now we trust RBAC_MANAGE
    if (role.name === 'company_admin') {
      throw new AppError('Cannot delete company_admin role', StatusCodes.BAD_REQUEST, ERROR_CODES.CONFLICT);
    }
    return rbacRepository.deleteRole(tenantId, roleId);
  },
};
