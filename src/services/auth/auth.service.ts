import { UserStatus } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { comparePassword, hashPassword } from '../../common/auth/password';
import { createTokenHash } from '../../common/auth/tokenHash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../common/auth/jwt';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { authRepository } from '../../repositories/auth/auth.repository';
import { LoginInput, RefreshTokenInput, RegisterAdminInput } from '../../types/auth/auth.payloads';

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
      user,
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
      user,
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

  async me(userId: string) {
    const user = await authRepository.findUserById(userId);

    if (!user) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return user;
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
};
