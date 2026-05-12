import crypto from 'node:crypto';
import { UserStatus } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { comparePassword, hashPassword } from '../../common/auth/password';
import { createTokenHash } from '../../common/auth/tokenHash';
import { generateResetToken, getResetTokenExpiryDate } from '../../common/auth/inviteToken';
import {
  signAccessToken,
  signCompanyRegistrationEmailToken,
  signRefreshToken,
  verifyCompanyRegistrationEmailToken,
  verifyRefreshToken,
} from '../../common/auth/jwt';
import { PERMISSIONS } from '../../common/constants/permissions';
import { sendEmail } from '../../common/email/emailProvider';
import { companyRegistrationOtpEmailTemplate } from '../../common/email/templates/companyRegistrationOtpEmail';
import { passwordResetEmailTemplate } from '../../common/email/templates/passwordResetEmail';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { getFirebaseAdmin } from '../../common/firebase/firebaseAdmin';
import { getSupabaseAdmin } from '../../common/supabase/supabaseAdmin';
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

const COMPANY_SIGNUP_OTP_TTL_MS = 10 * 60 * 1000;
const COMPANY_SIGNUP_OTP_COOLDOWN_MS_PROD = 45 * 1000;
const COMPANY_SIGNUP_OTP_COOLDOWN_MS_DEV = 10 * 1000;
const COMPANY_SIGNUP_OTP_MAX_ATTEMPTS = 8;

const companySignupOtpCooldownMs = () =>
  env.NODE_ENV === 'development' ? COMPANY_SIGNUP_OTP_COOLDOWN_MS_DEV : COMPANY_SIGNUP_OTP_COOLDOWN_MS_PROD;

const hashCompanySignupOtpCode = (email: string, code: string): string =>
  createTokenHash(`company-signup-otp|${email.trim().toLowerCase()}|${code.trim()}`);

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
  async sendCompanySignupEmailOtp(payload: { email: string }): Promise<{ sent: true }> {
    const email = payload.email.trim().toLowerCase();
    if (!email) {
      throw new AppError('Email is required', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const latest = await authRepository.findLatestCompanySignupOtp(email);
    const cooldownMs = companySignupOtpCooldownMs();
    const elapsed = latest ? Date.now() - latest.createdAt.getTime() : Infinity;
    if (latest && !latest.consumedAt && elapsed < cooldownMs) {
      const waitSec = Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000));
      throw new AppError(
        `A verification code was just sent to this email. Try again in ${waitSec}s (rate limit to prevent abuse).`,
        StatusCodes.TOO_MANY_REQUESTS,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashCompanySignupOtpCode(email, code);
    const expiresAt = new Date(Date.now() + COMPANY_SIGNUP_OTP_TTL_MS);

    await authRepository.deletePendingCompanySignupOtpsForEmail(email);
    await authRepository.createCompanySignupEmailOtp({ email, codeHash, expiresAt });

    await sendEmail({
      to: email,
      subject: 'Your Kofeko company signup verification code',
      html: companyRegistrationOtpEmailTemplate({ code }),
    });

    return { sent: true };
  },

  async verifyCompanySignupEmailOtp(payload: { email: string; code: string }): Promise<{ emailVerificationToken: string }> {
    const email = payload.email.trim().toLowerCase();
    const code = payload.code.trim();
    if (!email || !/^\d{6}$/.test(code)) {
      throw new AppError('Invalid email or code', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const otp = await authRepository.findActiveCompanySignupOtp(email);
    if (!otp) {
      throw new AppError('Code expired or not found. Request a new code.', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    if (otp.attempts >= COMPANY_SIGNUP_OTP_MAX_ATTEMPTS) {
      throw new AppError('Too many attempts. Request a new code.', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const expectedHash = hashCompanySignupOtpCode(email, code);
    if (expectedHash !== otp.codeHash) {
      await authRepository.incrementCompanySignupOtpAttempts(otp.id);
      throw new AppError('Invalid verification code', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    await authRepository.markCompanySignupOtpConsumed(otp.id);
    const emailVerificationToken = signCompanyRegistrationEmailToken(email);
    return { emailVerificationToken };
  },

  async registerCompanyRequest(payload: RegisterCompanyRequestInput) {
    const adminEmail = payload.adminEmail.trim().toLowerCase();
    let verifiedEmail: string;
    try {
      verifiedEmail = verifyCompanyRegistrationEmailToken(payload.emailVerificationToken).email;
    } catch {
      throw new AppError(
        'Verify your admin email with the code we sent before submitting registration.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }
    if (verifiedEmail !== adminEmail) {
      throw new AppError(
        'Email verification does not match the admin email on this form.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const adminPasswordHash = await hashPassword(payload.password);
    const { password: _password, emailVerificationToken: _token, ...rest } = payload;
    const request = await authRepository.createCompanyRegistrationRequest({
      ...rest,
      adminEmail,
      adminPasswordHash,
    });

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
    const email = payload.email.trim().toLowerCase();
    const candidateTenantSlug = process.env.CANDIDATE_TENANT_SLUG ?? 'kofeko-candidates';

    const user = payload.tenantSlug
      ? await authRepository.findUserByTenantSlugAndEmail(payload.tenantSlug, email)
      : await (async () => {
          const users = await authRepository.findStaffUsersByEmailForLogin(email, { excludeTenantSlug: candidateTenantSlug });
          if (users.length === 1) return users[0];
          if (users.length > 1) {
            throw new AppError(
              'Multiple accounts found for this email. Please contact support.',
              StatusCodes.CONFLICT,
              ERROR_CODES.CONFLICT,
            );
          }
          return null;
        })();

    if (!user) {
      throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    if (user.tenant.status === 'suspended') {
      throw new AppError('This account has been suspended. Contact support.', StatusCodes.FORBIDDEN, ERROR_CODES.TENANT_SUSPENDED);
    }

    if (user.status !== UserStatus.active && user.status !== UserStatus.invited) {
      throw new AppError('User is not active', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN);
    }

    const isPasswordValid = await comparePassword(payload.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    if (user.otpRequired) {
      await authRepository.consumeLoginOtp(user.id, user.tenantId);
    }

    if (user.status === UserStatus.invited) {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.active },
      });
      user.status = UserStatus.active;
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

  async loginCandidateWithGoogle(payload: { idToken: string }, userAgent?: string, ipAddress?: string) {
    const candidateTenantSlug = process.env.CANDIDATE_TENANT_SLUG ?? 'kofeko-candidates';
    const candidateTenantName = process.env.CANDIDATE_TENANT_NAME ?? 'Kofeko Candidates';

    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(payload.idToken);

    const email = decoded.email;
    if (!email) {
      throw new AppError('Google account has no email', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const displayName = String(decoded.name ?? '').trim();
    const nameParts = displayName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? 'Candidate';
    const lastName = nameParts.slice(1).join(' ') || 'Candidate';

    let user = await authRepository.findUserByTenantSlugAndEmail(candidateTenantSlug, email);

    if (!user) {
      const { randomBytes } = await import('node:crypto');
      const randomPassword = randomBytes(24).toString('hex');
      const passwordHash = await hashPassword(randomPassword);

      const { tenant, user: createdUser } = await authRepository.bootstrapCandidateUser({
        tenantSlug: candidateTenantSlug,
        tenantName: candidateTenantName,
        firstName,
        lastName,
        email,
        passwordHash,
        permissionKeys: Object.values(PERMISSIONS),
      });

      const hydrated = await authRepository.findUserByIdAndTenant(createdUser.id, tenant.id);
      if (!hydrated) {
        throw new AppError('User not found after registration', StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
      user = hydrated;
    }

    if (user.status !== UserStatus.active) {
      throw new AppError('User is not active', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN);
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

  async loginCandidateWithSupabase(payload: { accessToken: string }, userAgent?: string, ipAddress?: string) {
    const candidateTenantSlug = process.env.CANDIDATE_TENANT_SLUG ?? 'kofeko-candidates';
    const candidateTenantName = process.env.CANDIDATE_TENANT_NAME ?? 'Kofeko Candidates';

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(payload.accessToken);
    if (error || !data.user) {
      throw new AppError('Invalid Supabase token', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    const email = data.user.email;
    if (!email) {
      throw new AppError('Supabase user has no email', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const fullName = String(meta.full_name ?? meta.name ?? '').trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? 'Candidate';
    const lastName = nameParts.slice(1).join(' ') || 'Candidate';

    let user = await authRepository.findUserByTenantSlugAndEmail(candidateTenantSlug, email);

    if (!user) {
      const { randomBytes } = await import('node:crypto');
      const randomPassword = randomBytes(24).toString('hex');
      const passwordHash = await hashPassword(randomPassword);

      const { tenant, user: createdUser } = await authRepository.bootstrapCandidateUser({
        tenantSlug: candidateTenantSlug,
        tenantName: candidateTenantName,
        firstName,
        lastName,
        email,
        passwordHash,
        permissionKeys: Object.values(PERMISSIONS),
      });

      const hydrated = await authRepository.findUserByIdAndTenant(createdUser.id, tenant.id);
      if (!hydrated) {
        throw new AppError('User not found after registration', StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
      user = hydrated;
    }

    if (user.status !== UserStatus.active) {
      throw new AppError('User is not active', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN);
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
