import { User, UserStatus } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import crypto from 'node:crypto';
import { hashPassword } from '../../common/auth/password';
import { ROLE_NAMES } from '../../common/constants/roles';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { userRepository } from '../../repositories/user/user.repository';
import { CreateUserInput, InviteUserInput, UpdateUserInput } from '../../types/user/user.types';

const resolveRoleForTenant = async (tenantId: string, roleName: string) => {
  const role = await userRepository.findRoleByTenantAndName(tenantId, roleName);

  if (!role) {
    throw new AppError(
      `Role '${roleName}' is not configured for this tenant`,
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  return role;
};

export const userService = {
  async createUser(payload: CreateUserInput): Promise<User> {
    const passwordHash = await hashPassword(payload.password);
    const roleName = payload.roleName ?? ROLE_NAMES.RECRUITER;
    const role = await resolveRoleForTenant(payload.tenantId, roleName);

    return userRepository.createWithRole({
      tenantId: payload.tenantId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      passwordHash,
      roleId: role.id,
      status: payload.status ?? UserStatus.active,
    });
  },

  async inviteUser(payload: InviteUserInput): Promise<User> {
    const roleName = payload.roleName ?? ROLE_NAMES.RECRUITER;
    const role = await resolveRoleForTenant(payload.tenantId, roleName);
    const existingUser = await userRepository.findByTenantAndEmail(payload.tenantId, payload.email);

    if (existingUser) {
      throw new AppError('User with this email already exists in tenant', StatusCodes.CONFLICT, ERROR_CODES.CONFLICT);
    }

    const temporaryPassword = crypto.randomBytes(24).toString('hex');
    const passwordHash = await hashPassword(temporaryPassword);

    return userRepository.createWithRole({
      tenantId: payload.tenantId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      passwordHash,
      roleId: role.id,
      status: UserStatus.invited,
    });
  },

  async getUserById(id: string, tenantId: string): Promise<User> {
    const user = await userRepository.findByIdAndTenant(id, tenantId);

    if (!user) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return user;
  },

  async listUsersByTenant(tenantId: string): Promise<User[]> {
    return userRepository.listByTenant(tenantId);
  },

  async updateUser(id: string, tenantId: string, payload: UpdateUserInput): Promise<User> {
    await this.getUserById(id, tenantId);
    return userRepository.updateByIdAndTenant(id, tenantId, payload);
  },
};
