import { UserStatus } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { comparePassword, hashPassword } from '../../common/auth/password';
import { createTokenHash } from '../../common/auth/tokenHash';
import { generateResetToken, getResetTokenExpiryDate } from '../../common/auth/inviteToken';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../common/auth/jwt';
import { PERMISSIONS } from '../../common/constants/permissions';
import { sendEmail } from '../../common/email/emailProvider';
import { passwordResetEmailTemplate } from '../../common/email/templates/passwordResetEmail';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { authRepository } from '../../repositories/auth/auth.repository';
import {
  AcceptInviteInput,
  ForgotPasswordInput,
  LoginInput,
  RefreshTokenInput,
  RegisterAdminInput,
  RegisterCompanyRequestInput,
  ResetPasswordInput,
} from '../../types/auth/auth.payloads';
import { LoginCandidateInput, RegisterCandidateInput } from '../../types/auth/auth.payloads';
import { auditService } from '../audit/audit.service';

const sanitizeUser = <T extends { passwordHash: string }>(user: T): Omit<T, 'passwordHash'> => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

const formatAuthUser = (user: any) => {
  const safeUser = sanitizeUser(user);
  const permissions = Array.from(
    new Set(
      (user.userRoles ?? []).flatMap((userRole: any) =>
        (userRole.role?.rolePermissions ?? []).map((rp: any) => rp.permission?.key),
      ),
    ),
  ).filter(Boolean) as string[];

  const roles = (user.userRoles ?? []).map((userRole: any) => userRole.role?.name).filter(Boolean) as string[];

  return {
    ...safeUser,
    permissions,
    roles,
  };
};

const getRefreshExpiryDate = (): Date => {
  const value = env.JWT_REFRESH_EXPIRES_IN;
  const match = value.match(/^(\d+)([mhd])$/);

  if (!match) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  const factor = unit === 'm' ? 60 * 1000 : unit === 'h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  return new Date(Date.now() + amount * factor);
};

export const authService = {
  async registerCompanyRequest(payload: RegisterCompanyRequestInput) {
    const request = await authRepository.createCompanyRegistrationRequest(payload);

    return {
      requestId: request.id,
      status: request.status,
      message: 'Company registration submitted and pending super admin approval',
    };
  },

  async registerAdmin(payload: RegisterAdminInput, userAgent?: string, ipAddress?: string) {
    const passwordHash = await hashPassword(payload.password);

    const { tenant, user } = await authRepository.bootstrapTenantAdmin({
      tenantName: payload.tenantName,
      tenantSlug: payload.tenantSlug,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      passwordHash,
      permissionKeys: Object.values(PERMISSIONS),
    });

    const tokenPayload = {
      sub: user.id,
      tenantId: tenant.id,
      email: user.email,
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    await authRepository.createSession({
      tenantId: tenant.id,
      userId: user.id,
      refreshTokenHash: createTokenHash(refreshToken),
      userAgent,
      ipAddress,
      expiresAt: getRefreshExpiryDate(),
    });

    return {
      accessToken,
      refreshToken,
      user: formatAuthUser(user),
      tenant,
    };
  },

  async login(payload: LoginInput, userAgent?: string, ipAddress?: string) {
    const user = await authRepository.findUserByTenantSlugAndEmail(payload.tenantSlug, payload.email);

    if (!user) {
      throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    if (user.status !== UserStatus.active) {
      throw new AppError('User is not active', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN);
    }

    const isPasswordValid = await comparePassword(payload.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    if (user.otpRequired) {
      if (!payload.otp) {
        throw new AppError('OTP is required for first login', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
      }
      if (!user.loginOtpHash || !user.loginOtpExpiresAt || user.loginOtpExpiresAt < new Date()) {
        throw new AppError('OTP expired. Please contact super admin.', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
      }
      const isOtpValid = await comparePassword(payload.otp, user.loginOtpHash);
      if (!isOtpValid) {
        throw new AppError('Invalid OTP', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
      }
      await authRepository.consumeLoginOtp(user.id, user.tenantId);
    }

    const tokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    await authRepository.createSession({
      tenantId: user.tenantId,
      userId: user.id,
      refreshTokenHash: createTokenHash(refreshToken),
      userAgent,
      ipAddress,
      expiresAt: getRefreshExpiryDate(),
    });

    return {
      accessToken,
      refreshToken,
      user: formatAuthUser(user),
      tenant: user.tenant,
    };
  },

  async registerCandidate(payload: RegisterCandidateInput, userAgent?: string, ipAddress?: string) {
    const candidateTenantSlug = process.env.CANDIDATE_TENANT_SLUG ?? 'kofeko-candidates';
    const candidateTenantName = process.env.CANDIDATE_TENANT_NAME ?? 'Kofeko Candidates';
    const passwordHash = await hashPassword(payload.password);

    const { tenant, user } = await authRepository.bootstrapCandidateUser({
      tenantSlug: candidateTenantSlug,
      tenantName: candidateTenantName,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      passwordHash,
      permissionKeys: Object.values(PERMISSIONS),
    });

    const hydratedUser = await authRepository.findUserByIdAndTenant(user.id, tenant.id);
    if (!hydratedUser) {
      throw new AppError('User not found after registration', StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }

    const tokenPayload = {
      sub: hydratedUser.id,
      tenantId: tenant.id,
      email: hydratedUser.email,
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    await authRepository.createSession({
      tenantId: tenant.id,
      userId: hydratedUser.id,
      refreshTokenHash: createTokenHash(refreshToken),
      userAgent,
      ipAddress,
      expiresAt: getRefreshExpiryDate(),
    });

    return {
      accessToken,
      refreshToken,
      user: formatAuthUser(hydratedUser),
      tenant,
    };
  },

  async loginCandidate(payload: LoginCandidateInput, userAgent?: string, ipAddress?: string) {
    const candidateTenantSlug = process.env.CANDIDATE_TENANT_SLUG ?? 'kofeko-candidates';
    const user = await authRepository.findUserByTenantSlugAndEmail(candidateTenantSlug, payload.email);

    if (!user) {
      throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }
    if (user.status !== UserStatus.active) {
      throw new AppError('User is not active', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN);
    }

    const isPasswordValid = await comparePassword(payload.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    const tokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
    };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    await authRepository.createSession({
      tenantId: user.tenantId,
      userId: user.id,
      refreshTokenHash: createTokenHash(refreshToken),
      userAgent,
      ipAddress,
      expiresAt: getRefreshExpiryDate(),
    });

    return {
      accessToken,
      refreshToken,
      user: formatAuthUser(user),
      tenant: user.tenant,
    };
  },

  async refreshToken(payload: RefreshTokenInput) {
    const decoded = verifyRefreshToken(payload.refreshToken);
    const refreshTokenHash = createTokenHash(payload.refreshToken);

    const session = await authRepository.findValidSession(decoded.sub, decoded.tenantId, refreshTokenHash);

    if (!session) {
      throw new AppError('Invalid refresh token', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    const newAccessToken = signAccessToken({
      sub: decoded.sub,
      tenantId: decoded.tenantId,
      email: decoded.email,
    });

    return { accessToken: newAccessToken };
  },

  async me(userId: string, tenantId: string) {
    const user = await authRepository.findUserByIdAndTenant(userId, tenantId);

    if (!user) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return formatAuthUser(user);
  },

  async logout(refreshToken: string): Promise<void> {
    const decoded = verifyRefreshToken(refreshToken);
    const refreshTokenHash = createTokenHash(refreshToken);

    const session = await authRepository.findValidSession(decoded.sub, decoded.tenantId, refreshTokenHash);

    if (!session) {
      return;
    }

    await authRepository.revokeSession(session.id);
  },

  async acceptInvite(payload: AcceptInviteInput) {
    const tokenHash = createTokenHash(payload.token);
    const inviteToken = await authRepository.findInviteTokenByToken(tokenHash);

    if (!inviteToken) {
      throw new AppError('Invalid invite token', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    if (inviteToken.usedAt) {
      throw new AppError('Invite token has already been used', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    if (inviteToken.expiresAt.getTime() < Date.now()) {
      throw new AppError('Invite token has expired', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const passwordHash = await hashPassword(payload.password);
    const user = await authRepository.activateUserWithPassword(inviteToken.userId, inviteToken.tenantId, passwordHash);
    await authRepository.markInviteTokenUsed(inviteToken.id);

    await auditService.createAuditLog({
      tenantId: inviteToken.tenantId,
      actorId: user.id,
      action: 'update',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        inviteAccepted: true,
      },
    });

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  },

  async forgotPassword(payload: ForgotPasswordInput): Promise<void> {
    const tenant = await authRepository.findTenantBySlug(payload.tenantSlug);

    if (!tenant) {
      return;
    }

    const user = await authRepository.findUserByTenantAndEmail(tenant.id, payload.email);

    if (!user) {
      return;
    }

    const rawToken = generateResetToken();
    const tokenHash = createTokenHash(rawToken);

    await authRepository.createPasswordResetToken({
      tenantId: tenant.id,
      userId: user.id,
      token: tokenHash,
      expiresAt: getResetTokenExpiryDate(),
    });

    const resetLink = `${env.APP_FRONTEND_URL}/reset-password?token=${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Reset your Kofeko password',
      html: passwordResetEmailTemplate({
        resetLink,
        userName: `${user.firstName} ${user.lastName}`.trim(),
      }),
    });

    await auditService.createAuditLog({
      tenantId: tenant.id,
      actorId: user.id,
      action: 'create',
      entityType: 'password_reset',
      entityId: user.id,
      metadata: {
        email: user.email,
      },
    });
  },

  async resetPassword(payload: ResetPasswordInput): Promise<void> {
    const tokenHash = createTokenHash(payload.token);
    const resetToken = await authRepository.findPasswordResetTokenByToken(tokenHash);

    if (!resetToken) {
      throw new AppError('Invalid reset token', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    if (resetToken.usedAt) {
      throw new AppError('Reset token has already been used', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    if (resetToken.expiresAt.getTime() < Date.now()) {
      throw new AppError('Reset token has expired', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const passwordHash = await hashPassword(payload.password);
    await authRepository.updateUserPassword(resetToken.userId, passwordHash);
    await authRepository.markPasswordResetTokenUsed(resetToken.id);

    await auditService.createAuditLog({
      tenantId: resetToken.tenantId,
      actorId: resetToken.userId,
      action: 'update',
      entityType: 'user',
      entityId: resetToken.userId,
      metadata: {
        passwordReset: true,
      },
    });
  },
};
