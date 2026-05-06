import { User, UserStatus } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import crypto from 'node:crypto';
import { env } from '../../config/env';
import { hashPassword } from '../../common/auth/password';
import { createTokenHash } from '../../common/auth/tokenHash';
import { generateInviteToken, getInviteTokenExpiryDate } from '../../common/auth/inviteToken';
import { ROLE_NAMES } from '../../common/constants/roles';
import { sendEmail } from '../../common/email/emailProvider';
import { inviteEmailTemplate } from '../../common/email/templates/inviteEmail';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { auditService } from '../audit/audit.service';
import { authRepository } from '../../repositories/auth/auth.repository';
import { userRepository } from '../../repositories/user/user.repository';
import { CreateUserInput, InviteUserInput, UpdateUserInput } from '../../types/user/user.types';
import { PaginationInput } from '../../common/utils/pagination';

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

    const user = await userRepository.createWithRole({
      tenantId: payload.tenantId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      passwordHash,
      roleId: role.id,
      status: UserStatus.invited,
    });

    const rawToken = generateInviteToken();
    const tokenHash = createTokenHash(rawToken);

    await authRepository.createInviteToken({
      tenantId: payload.tenantId,
      userId: user.id,
      token: tokenHash,
      expiresAt: getInviteTokenExpiryDate(),
    });

    const inviteLink = `${env.APP_FRONTEND_URL}/accept-invite?token=${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: 'You are invited to Kofeko',
      html: inviteEmailTemplate({
        inviteLink,
        invitedUserName: `${user.firstName} ${user.lastName}`.trim(),
      }),
    });

    await auditService.createAuditLog({
      tenantId: payload.tenantId,
      actorId: payload.actorId,
      action: 'create',
      entityType: 'user_invite',
      entityId: user.id,
      metadata: {
        email: user.email,
        roleName,
      },
    });

    return user;
  },

  async getUserById(id: string, tenantId: string): Promise<User> {
    const user = await userRepository.findByIdAndTenant(id, tenantId);

    if (!user) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return user;
  },

  async listUsersByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: User[]; total: number }> {
    return userRepository.listByTenant(tenantId, { page: pagination.page, limit: pagination.limit });
  },

  async updateUser(id: string, tenantId: string, payload: UpdateUserInput): Promise<User> {
    await this.getUserById(id, tenantId);
    return userRepository.updateByIdAndTenant(id, tenantId, payload);
  },
};
