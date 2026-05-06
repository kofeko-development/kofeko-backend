import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { comparePassword, hashPassword } from '../../common/auth/password';
import { createTokenHash } from '../../common/auth/tokenHash';
import { signSuperAdminAccessToken, signSuperAdminRefreshToken, verifySuperAdminRefreshToken } from '../../common/auth/superAdmin.jwt';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { prisma } from '../../config/prisma';

const sanitizeSuperAdmin = <T extends { passwordHash: string }>(admin: T): Omit<T, 'passwordHash'> => {
  const { passwordHash: _passwordHash, ...safe } = admin;
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
      throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    const ok = await comparePassword(password, admin.passwordHash);
    if (!ok) {
      throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
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

  async refresh(refreshToken: string) {
    const decoded = verifySuperAdminRefreshToken(refreshToken);
    if (decoded.type !== 'super_admin') {
      throw new AppError('Invalid refresh token', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
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
      throw new AppError('Invalid refresh token', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
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
};
