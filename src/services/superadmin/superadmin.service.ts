import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { comparePassword, hashPassword } from '../../common/auth/password';
import { createTokenHash } from '../../common/auth/tokenHash';
import { generateResetToken, getResetTokenExpiryDate } from '../../common/auth/inviteToken';
import { signSuperAdminAccessToken, signSuperAdminRefreshToken, signSuperAdminPending2FAToken, verifySuperAdminRefreshToken, verifySuperAdminPending2FAToken } from '../../common/auth/superAdmin.jwt';
import { sendEmail } from '../../common/email/emailProvider';
import { passwordResetEmailTemplate } from '../../common/email/templates/passwordResetEmail';
import { AppError } from '../../common/errors/AppError';
import { emailFieldError } from '../../common/errors/fieldErrors';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { prisma } from '../../config/prisma';
import { logger } from '../../common/logger/logger';
import { superAdminTwoFactorService } from './superadmin-2fa.service';

const sanitizeSuperAdmin = <T extends { passwordHash: string; twoFactorSecret?: string | null; twoFactorBackupCodes?: string[] }>(
  admin: T,
): Omit<T, 'passwordHash' | 'twoFactorSecret' | 'twoFactorBackupCodes'> => {
  const { passwordHash: _passwordHash, twoFactorSecret: _twoFactorSecret, twoFactorBackupCodes: _backupCodes, ...safe } = admin;
  return safe;
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

export const superAdminService = {
  async bootstrap(
    payload: { email: string; password: string; firstName: string; lastName: string },
    setupKey: string,
  ) {
    if (!env.SUPER_ADMIN_SETUP_KEY || setupKey !== env.SUPER_ADMIN_SETUP_KEY) {
      throw new AppError('Invalid setup key', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN);
    }

    const existing = await prisma.superAdmin.findFirst();
    if (existing) {
      throw new AppError('Super admin already bootstrapped', StatusCodes.CONFLICT, ERROR_CODES.CONFLICT);
    }

    const passwordHash = await hashPassword(payload.password);
    const created = await prisma.superAdmin.create({
      data: {
        email: payload.email.toLowerCase(),
        passwordHash,
        firstName: payload.firstName,
        lastName: payload.lastName,
      },
    });

    return sanitizeSuperAdmin(created);
  },

  async login(email: string, password: string, userAgent?: string, ipAddress?: string) {
    const admin = await prisma.superAdmin.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!admin) {
      throw new AppError(
        'No account found with this email. Contact the platform administrator.',
        StatusCodes.NOT_FOUND,
        ERROR_CODES.EMAIL_NOT_FOUND,
        emailFieldError('No account found with this email. Contact the platform administrator.'),
      );
    }

    const ok = await comparePassword(password, admin.passwordHash);
    if (!ok) {
      throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    if (admin.twoFactorEnabled) {
      const pendingToken = signSuperAdminPending2FAToken({
        sub: admin.id,
        type: 'super_admin_2fa_pending',
      });
      return {
        requiresTwoFactor: true as const,
        pendingToken,
        superAdmin: sanitizeSuperAdmin(admin),
      };
    }

    const payload = { sub: admin.id, type: 'super_admin' as const };
    const accessToken = signSuperAdminAccessToken(payload);
    const refreshToken = signSuperAdminRefreshToken(payload);

    await prisma.superAdminSession.create({
      data: {
        superAdminId: admin.id,
        refreshTokenHash: createTokenHash(refreshToken),
        userAgent,
        ipAddress,
        expiresAt: getRefreshExpiryDate(),
      },
    });

    return {
      accessToken,
      refreshToken,
      superAdmin: sanitizeSuperAdmin(admin),
    };
  },

  async verifyLogin2FA(pendingToken: string, code: string, userAgent?: string, ipAddress?: string) {
    let decoded;
    try {
      decoded = verifySuperAdminPending2FAToken(pendingToken);
    } catch {
      throw new AppError('Verification session expired. Please sign in again.', StatusCodes.UNAUTHORIZED, ERROR_CODES.TOKEN_EXPIRED);
    }

    const admin = await prisma.superAdmin.findUnique({ where: { id: decoded.sub } });
    if (!admin) {
      throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    await superAdminTwoFactorService.verifyLoginCode(admin.id, code);

    const payload = { sub: admin.id, type: 'super_admin' as const };
    const accessToken = signSuperAdminAccessToken(payload);
    const refreshToken = signSuperAdminRefreshToken(payload);

    await prisma.superAdminSession.create({
      data: {
        superAdminId: admin.id,
        refreshTokenHash: createTokenHash(refreshToken),
        userAgent,
        ipAddress,
        expiresAt: getRefreshExpiryDate(),
      },
    });

    return {
      accessToken,
      refreshToken,
      superAdmin: sanitizeSuperAdmin(admin),
    };
  },

  async refresh(refreshToken: string) {
    const decoded = verifySuperAdminRefreshToken(refreshToken);
    if (decoded.type !== 'super_admin') {
      throw new AppError('Session expired, please log in again', StatusCodes.UNAUTHORIZED, ERROR_CODES.TOKEN_EXPIRED);
    }

    const session = await prisma.superAdminSession.findFirst({
      where: {
        superAdminId: decoded.sub,
        refreshTokenHash: createTokenHash(refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      throw new AppError('Session expired, please log in again', StatusCodes.UNAUTHORIZED, ERROR_CODES.TOKEN_EXPIRED);
    }

    const accessToken = signSuperAdminAccessToken({ sub: decoded.sub, type: 'super_admin' });
    return { accessToken };
  },

  async logout(refreshToken: string) {
    const decoded = verifySuperAdminRefreshToken(refreshToken);
    if (decoded.type !== 'super_admin') {
      return;
    }

    const session = await prisma.superAdminSession.findFirst({
      where: {
        superAdminId: decoded.sub,
        refreshTokenHash: createTokenHash(refreshToken),
        revokedAt: null,
      },
    });

    if (!session) {
      return;
    }

    await prisma.superAdminSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
  },

  async me(superAdminId: string) {
    const admin = await prisma.superAdmin.findUnique({ where: { id: superAdminId } });
    if (!admin) {
      throw new AppError('Super admin not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return sanitizeSuperAdmin(admin);
  },

  /** Update login email and/or password; requires current password. Revokes all sessions when password changes. */
  async updateProfile(
    superAdminId: string,
    input: { currentPassword: string; email?: string; newPassword?: string },
  ) {
    if (!input.email?.trim() && !input.newPassword) {
      throw new AppError(
        'Provide at least one of email or newPassword',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const admin = await prisma.superAdmin.findUnique({ where: { id: superAdminId } });
    if (!admin) {
      throw new AppError('Super admin not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const currentOk = await comparePassword(input.currentPassword, admin.passwordHash);
    if (!currentOk) {
      throw new AppError('Current password is incorrect', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    const nextEmail = input.email?.trim().toLowerCase();
    if (nextEmail && nextEmail !== admin.email) {
      const taken = await prisma.superAdmin.findUnique({ where: { email: nextEmail } });
      if (taken) {
        throw new AppError('Email is already in use', StatusCodes.CONFLICT, ERROR_CODES.CONFLICT);
      }
    }

    const data: { email?: string; passwordHash?: string } = {};
    if (nextEmail && nextEmail !== admin.email) {
      data.email = nextEmail;
    }
    if (input.newPassword) {
      data.passwordHash = await hashPassword(input.newPassword);
    }

    if (Object.keys(data).length === 0) {
      return sanitizeSuperAdmin(admin);
    }

    const updated = await prisma.superAdmin.update({
      where: { id: superAdminId },
      data,
    });

    if (input.newPassword) {
      await prisma.superAdminSession.deleteMany({ where: { superAdminId } });
    }

    return sanitizeSuperAdmin(updated);
  },

  async forgotPassword(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const admin = await prisma.superAdmin.findUnique({ where: { email: normalized } });
    if (!admin) {
      return;
    }

    const rawToken = generateResetToken();
    const tokenHash = createTokenHash(rawToken);

    await prisma.superAdminPasswordResetToken.create({
      data: {
        superAdminId: admin.id,
        token: tokenHash,
        expiresAt: getResetTokenExpiryDate(),
      },
    });

    const resetLink = `${env.APP_FRONTEND_URL}/superadmin/reset-password?token=${rawToken}`;
    const userName = `${admin.firstName} ${admin.lastName}`.trim();
    logger.info({ email: admin.email, resetLink }, 'Superadmin password reset link generated');

    await sendEmail({
      to: admin.email,
      subject: 'Reset your Kofeko superadmin password',
      html: passwordResetEmailTemplate({ resetLink, userName }),
    });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    const tokenHash = createTokenHash(token);
    const resetToken = await prisma.superAdminPasswordResetToken.findUnique({
      where: { token: tokenHash },
      include: { superAdmin: true },
    });

    if (!resetToken) {
      throw new AppError(
        'Invalid reset link. Request a new password reset from the login page.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.RESET_TOKEN_INVALID,
      );
    }

    if (resetToken.usedAt) {
      throw new AppError(
        'This reset link has already been used. Request a new password reset if needed.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.RESET_TOKEN_USED,
      );
    }

    if (resetToken.expiresAt.getTime() < Date.now()) {
      throw new AppError(
        'This reset link has expired (valid for 1 hour). Request a new password reset.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.RESET_TOKEN_EXPIRED,
      );
    }

    const passwordHash = await hashPassword(password);
    await prisma.superAdmin.update({
      where: { id: resetToken.superAdminId },
      data: { passwordHash },
    });
    await prisma.superAdminPasswordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });
    await prisma.superAdminSession.deleteMany({ where: { superAdminId: resetToken.superAdminId } });
  },
};
