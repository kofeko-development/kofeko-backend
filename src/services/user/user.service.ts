import { Role, User, UserStatus } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import crypto from 'node:crypto';
import { env } from '../../config/env';
import { hashPassword } from '../../common/auth/password';
import { createTokenHash } from '../../common/auth/tokenHash';
import { generateInviteToken, getInviteTokenExpiryDate } from '../../common/auth/inviteToken';
import { PERMISSIONS } from '../../common/constants/permissions';
import { ROLE_NAMES } from '../../common/constants/roles';
import { prisma } from '../../config/prisma';
import { sendEmail } from '../../common/email/emailProvider';
import { generateReadableTemporaryPassword } from '../../common/auth/temporaryPassword';
import { inviteEmailTemplate } from '../../common/email/templates/inviteEmail';
import { buildInviteRoleEmailSection, inviteEmailSubject } from '../../common/email/templates/inviteRoleCopy';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { auditService } from '../audit/audit.service';
import { authRepository } from '../../repositories/auth/auth.repository';
import { userRepository } from '../../repositories/user/user.repository';
import { CreateUserInput, InviteUserInput, UpdateUserInput } from '../../types/user/user.types';
import { PaginationInput } from '../../common/utils/pagination';

const ALL_KNOWN_PERMISSION_KEYS = new Set<string>(Object.values(PERMISSIONS));
/** Never grant platform RBAC admin via staff invite. */
const INVITE_BLOCKED_PERMISSION_KEYS = new Set<string>([PERMISSIONS.RBAC_MANAGE]);

function sanitizeInvitePermissionKeys(keys: string[] | undefined): string[] {
  if (!keys?.length) return [];
  return [...new Set(keys)].filter((k) => ALL_KNOWN_PERMISSION_KEYS.has(k) && !INVITE_BLOCKED_PERMISSION_KEYS.has(k));
}

async function createCustomInviteRole(tenantId: string, title: string, permissionKeys: string[]): Promise<Role> {
  const uniqueKeys = [...new Set(permissionKeys)];
  if (uniqueKeys.length === 0) {
    throw new AppError(
      'Select at least one permission for a custom role',
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const roleName = `custom_${crypto.randomBytes(8).toString('hex')}`;
  const description = title.trim().slice(0, 250) || 'Custom invited role';

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        tenantId,
        name: roleName,
        description,
      },
    });

    const permissions = await tx.permission.findMany({
      where: { tenantId, key: { in: uniqueKeys } },
    });

    if (permissions.length !== uniqueKeys.length) {
      const found = new Set(permissions.map((p) => p.key));
      const missing = uniqueKeys.filter((k) => !found.has(k));
      throw new AppError(
        `These permissions are not available for your workspace: ${missing.join(', ')}`,
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    await tx.rolePermission.createMany({
      data: permissions.map((p) => ({
        tenantId,
        roleId: role.id,
        permissionId: p.id,
      })),
      skipDuplicates: true,
    });

    return role;
  });
}

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
    const duplicate = await userRepository.findByTenantAndEmail(payload.tenantId, payload.email);
    if (duplicate) {
      throw new AppError('User with this email already exists in tenant', StatusCodes.CONFLICT, ERROR_CODES.CONFLICT);
    }

    const rawCustomKeys = payload.permissionKeys?.filter((k) => typeof k === 'string' && k.trim()) ?? [];
    const customKeys = sanitizeInvitePermissionKeys(payload.permissionKeys);
    if (rawCustomKeys.length > 0 && customKeys.length === 0) {
      throw new AppError(
        'No valid permissions selected. Remove invalid entries or avoid restricted permissions.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    let role: Role;
    let auditRoleName: string;

    if (customKeys.length > 0) {
      const title = payload.position?.trim();
      if (!title) {
        throw new AppError(
          'Position / role title is required when assigning custom permissions',
          StatusCodes.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }
      role = await createCustomInviteRole(payload.tenantId, title, customKeys);
      auditRoleName = role.name;
    } else {
      const roleName = payload.roleName ?? ROLE_NAMES.RECRUITER;
      role = await resolveRoleForTenant(payload.tenantId, roleName);
      auditRoleName = roleName;
    }

    const temporaryPassword = generateReadableTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const isCustomInvite = customKeys.length > 0;
    const { roleTitle, responsibilitiesSectionHtml } = buildInviteRoleEmailSection({
      isCustom: isCustomInvite,
      position: payload.position,
      roleNameKey: isCustomInvite ? undefined : (payload.roleName ?? ROLE_NAMES.RECRUITER),
    });

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
    const loginUrl = `${env.APP_FRONTEND_URL.replace(/\/$/, '')}/login`;

    const tenant = await prisma.tenant.findUnique({
      where: { id: payload.tenantId },
      select: { name: true, slug: true },
    });

    await sendEmail({
      to: user.email,
      subject: inviteEmailSubject(roleTitle),
      html: inviteEmailTemplate({
        inviteLink,
        invitedUserName: `${user.firstName} ${user.lastName}`.trim(),
        inviteeEmail: user.email,
        tenantName: tenant?.name,
        tenantSlug: tenant?.slug,
        loginUrl,
        temporaryPassword,
        roleTitle,
        responsibilitiesSectionHtml,
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
        roleName: auditRoleName,
        position: payload.position,
        ...(customKeys.length > 0 ? { permissionKeys: customKeys } : {}),
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
    
    const { roleName, ...updateData } = payload;
    
    if (roleName) {
      const role = await resolveRoleForTenant(tenantId, roleName);
      
      await prisma.$transaction(async (tx) => {
        await tx.userRole.deleteMany({
          where: { tenantId, userId: id }
        });
        
        await tx.userRole.create({
          data: {
            tenantId,
            userId: id,
            roleId: role.id
          }
        });
      });
    }

    if (Object.keys(updateData).length > 0) {
      const updated = await userRepository.updateByIdAndTenant(id, tenantId, updateData);
      if (
        updateData.status === UserStatus.invited ||
        updateData.status === UserStatus.suspended
      ) {
        await prisma.session.deleteMany({ where: { tenantId, userId: id } });
      }
      return updated;
    }
    
    return this.getUserById(id, tenantId);
  },

  async deleteUser(id: string, tenantId: string): Promise<void> {
    await this.getUserById(id, tenantId);
    
    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { tenantId, userId: id } }),
      prisma.inviteToken.deleteMany({ where: { tenantId, userId: id } }),
      prisma.passwordResetToken.deleteMany({ where: { tenantId, userId: id } }),
      prisma.session.deleteMany({ where: { tenantId, userId: id } }),
      prisma.user.delete({ where: { id, tenantId } })
    ]);
  },
};
