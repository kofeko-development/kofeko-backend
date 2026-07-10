import crypto from 'node:crypto';
import { UserStatus } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { comparePassword, hashPassword } from '../../common/auth/password';
import { createTokenHash } from '../../common/auth/tokenHash';
import { generateResetToken, getResetTokenExpiryDate } from '../../common/auth/inviteToken';
import { signCandidateAccessToken, signCandidateRefreshToken } from '../../common/auth/candidate.jwt';
import {
  signAccessToken,
  signCompanyRegistrationEmailToken,
  signRefreshToken,
  verifyCompanyRegistrationEmailToken,
  verifyRefreshToken,
  signCandidatePhoneVerificationToken,
  signCandidateSignupEmailToken,
  verifyCandidateSignupEmailToken,
} from '../../common/auth/jwt';
import { PERMISSIONS } from '../../common/constants/permissions';
import { sendEmail } from '../../common/email/emailProvider';
import { companyRegistrationOtpEmailTemplate } from '../../common/email/templates/companyRegistrationOtpEmail';
import {
  assertEmailAvailableForCompanyAccount,
  normalizeAccountEmail,
} from '../../common/auth/emailAvailability';
import { passwordResetEmailTemplate } from '../../common/email/templates/passwordResetEmail';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { cacheService, cacheKeys } from '../../common/cache/cacheService';
import { CACHE_SESSION_TTL } from '../../common/cache/cacheTtl';
import { getFirebaseAdmin } from '../../common/firebase/firebaseAdmin';
import { getSupabaseAdmin } from '../../common/supabase/supabaseAdmin';
import { authRepository } from '../../repositories/auth/auth.repository';
import { sendCompanyApprovalEmail } from '../email/approval-email.service';
import { userRepository } from '../../repositories/user/user.repository';
import {
  AcceptInviteInput,
  UpdateStaffProfileInput,
  ForgotPasswordInput,
  LoginInput,
  RefreshTokenInput,
  RegisterAdminInput,
  RegisterCompanyRequestInput,
  ResetPasswordInput,
} from '../../types/auth/auth.payloads';
import { LoginCandidateInput, RegisterCandidateInput } from '../../types/auth/auth.payloads';
import { auditService } from '../audit/audit.service';

const COMPANY_SIGNUP_OTP_TTL_MS = 60 * 1000;
const COMPANY_SIGNUP_OTP_COOLDOWN_MS = 60 * 1000;
const COMPANY_SIGNUP_OTP_MAX_ATTEMPTS = 8;
const COMPANY_SIGNUP_EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

const companySignupOtpCooldownMs = () => COMPANY_SIGNUP_OTP_COOLDOWN_MS;

const CANDIDATE_SIGNUP_OTP_TTL_MS = 10 * 60 * 1000;
const CANDIDATE_SIGNUP_OTP_COOLDOWN_MS_PROD = 45 * 1000;
const CANDIDATE_SIGNUP_OTP_COOLDOWN_MS_DEV = 10 * 1000;
const CANDIDATE_SIGNUP_OTP_MAX_ATTEMPTS = 8;

const candidateSignupOtpCooldownMs = () =>
  env.NODE_ENV === 'development' ? CANDIDATE_SIGNUP_OTP_COOLDOWN_MS_DEV : CANDIDATE_SIGNUP_OTP_COOLDOWN_MS_PROD;

const hashCandidateSignupOtpCode = (email: string, code: string): string =>
  createTokenHash(`candidate-signup-otp|${email.trim().toLowerCase()}|${code.trim()}`);

const hashCompanySignupOtpCode = (email: string, code: string): string =>
  createTokenHash(`company-signup-otp|${email.trim().toLowerCase()}|${code.trim()}`);

const sanitizeUser = <T extends { passwordHash: string }>(user: T): Omit<T, 'passwordHash'> => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

const formatAuthUser = (user: any, candidate?: any) => {
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
    // Candidate-specific fields
    summary: candidate?.summary || null,
    education: candidate?.education || [],
    workExperience: candidate?.workExperience || [],
    projects: candidate?.projects || [],
    hobbies: candidate?.hobbies || [],
    skills: candidate?.skills || [],
    phoneNumber: candidate?.phoneNumber || safeUser.phoneNumber || null,
    resumeUrl: candidate?.resumeUrl || null,
    linkedinProfileUrl: candidate?.linkedinUrl || safeUser.linkedinProfileUrl || null,
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
    const email = normalizeAccountEmail(payload.email);
    if (!email) {
      throw new AppError('Email is required', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    await assertEmailAvailableForCompanyAccount(email);

    const latest = await authRepository.findLatestCompanySignupOtp(email);
    const active = await authRepository.findActiveCompanySignupOtp(email);
    const cooldownMs = companySignupOtpCooldownMs();
    const elapsed = latest ? Date.now() - latest.createdAt.getTime() : Infinity;
    if (active && latest && !latest.consumedAt && elapsed < cooldownMs) {
      const waitSec = Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000));
      throw new AppError(
        `A verification code was just sent. Please wait ${waitSec} seconds before requesting another.`,
        StatusCodes.TOO_MANY_REQUESTS,
        ERROR_CODES.OTP_RATE_LIMITED,
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
      throw new AppError('Verification code has expired. Request a new one.', StatusCodes.BAD_REQUEST, ERROR_CODES.OTP_EXPIRED);
    }

    if (otp.attempts >= COMPANY_SIGNUP_OTP_MAX_ATTEMPTS) {
      throw new AppError('Too many incorrect attempts. Please request a new code.', StatusCodes.BAD_REQUEST, ERROR_CODES.OTP_MAX_ATTEMPTS);
    }

    const expectedHash = hashCompanySignupOtpCode(email, code);
    if (expectedHash !== otp.codeHash) {
      await authRepository.incrementCompanySignupOtpAttempts(otp.id);
      throw new AppError('Incorrect verification code. Please check the code in your email.', StatusCodes.BAD_REQUEST, ERROR_CODES.OTP_INVALID);
    }

    await authRepository.markCompanySignupOtpConsumed(otp.id);
    return { emailVerificationToken: signCompanyRegistrationEmailToken(email) };
  },

  async sendCandidateSignupEmailOtp(payload: { email: string }): Promise<{ sent: true }> {
    const email = payload.email.trim().toLowerCase();
    if (!email) {
      throw new AppError('Email is required', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    // Check if email already exists
    const existing = await authRepository.findCandidateByEmail(email);
    if (existing) {
      throw new AppError('An account with this email already exists.', StatusCodes.CONFLICT, ERROR_CODES.CONFLICT);
    }

    const latest = await authRepository.findLatestCandidateSignupOtp(email);
    const cooldownMs = candidateSignupOtpCooldownMs();
    const elapsed = latest ? Date.now() - latest.createdAt.getTime() : Infinity;
    if (latest && !latest.consumedAt && elapsed < cooldownMs) {
      const waitSec = Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000));
      throw new AppError(
        `A verification code was just sent to this email. Try again in ${waitSec}s.`,
        StatusCodes.TOO_MANY_REQUESTS,
        ERROR_CODES.OTP_RATE_LIMITED,
      );
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashCandidateSignupOtpCode(email, code);
    const expiresAt = new Date(Date.now() + CANDIDATE_SIGNUP_OTP_TTL_MS);

    await authRepository.deletePendingCandidateSignupOtpsForEmail(email);
    await authRepository.createCandidateSignupEmailOtp({ email, codeHash, expiresAt });

    await sendEmail({
      to: email,
      subject: 'Your Kofeko signup verification code',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-bottom: 16px;">Verify your email</h2>
          <p style="color: #475569; font-size: 16px; line-height: 24px;">Welcome to Kofeko! Use the following code to verify your email address and complete your signup.</p>
          <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-radius: 6px; margin: 24px 0;">
            <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #2563eb;">${code}</span>
          </div>
          <p style="color: #64748b; font-size: 14px;">This code will expire in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    return { sent: true };
  },

  async verifyCandidateSignupEmailOtp(payload: { email: string; code: string }): Promise<{ emailVerificationToken: string }> {
    const email = payload.email.trim().toLowerCase();
    const code = payload.code.trim();
    if (!email || !/^\d{6}$/.test(code)) {
      throw new AppError('Invalid email or code', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const otp = await authRepository.findActiveCandidateSignupEmailOtp(email);
    if (!otp) {
      throw new AppError('Verification code expired or not found. Please request a new one.', StatusCodes.BAD_REQUEST, ERROR_CODES.OTP_EXPIRED);
    }

    if (otp.attempts >= CANDIDATE_SIGNUP_OTP_MAX_ATTEMPTS) {
      throw new AppError('Too many failed attempts. Please request a new code.', StatusCodes.BAD_REQUEST, ERROR_CODES.OTP_MAX_ATTEMPTS);
    }

    const codeHash = hashCandidateSignupOtpCode(email, code);
    if (otp.codeHash !== codeHash) {
      await authRepository.incrementCandidateSignupOtpAttempts(otp.id);
      throw new AppError('Invalid verification code.', StatusCodes.BAD_REQUEST, ERROR_CODES.OTP_INVALID);
    }

    await authRepository.markCandidateSignupOtpConsumed(otp.id);
    return { emailVerificationToken: signCandidateSignupEmailToken(email) };
  },

  async verifyCandidatePhoneOtpMsg91(payload: { accessToken: string }): Promise<{ phoneVerificationToken: string }> {
    const { accessToken } = payload;
    if (!accessToken) {
      throw new AppError('MSG91 access token is required', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    try {
      const response = await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          authkey: process.env.MSG91_AUTH_KEY || '516208ArT3XzpJ6a0427d0P1',
          'access-token': accessToken,
        }),
      });

      const data = await response.json() as any;

      // MSG91 success response usually has type: 'success'
      // The phone number can be in 'mobile' or 'message' field depending on the widget config
      if (data.type !== 'success') {
        throw new AppError(data.message || 'OTP verification failed', StatusCodes.UNAUTHORIZED, ERROR_CODES.VALIDATION_ERROR);
      }

      const rawMobile = data.mobile || data.message;
      if (!rawMobile || typeof rawMobile !== 'string') {
        throw new AppError('Verified phone number not found in MSG91 response', StatusCodes.UNAUTHORIZED, ERROR_CODES.VALIDATION_ERROR);
      }

      // Ensure E.164 format
      const phoneNumber = rawMobile.startsWith('+') ? rawMobile : `+${rawMobile}`;

      const phoneVerificationToken = signCandidatePhoneVerificationToken(phoneNumber);
      return { phoneVerificationToken };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to verify OTP with MSG91', StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  },

  async registerCompanyRequest(payload: RegisterCompanyRequestInput) {
    const adminEmail = normalizeAccountEmail(payload.adminEmail);
    await assertEmailAvailableForCompanyAccount(adminEmail);
    let verifiedEmail: string | null = null;

    const token = payload.emailVerificationToken?.trim();
    if (token) {
      try {
        verifiedEmail = verifyCompanyRegistrationEmailToken(token).email;
      } catch {
        verifiedEmail = null;
      }
    }

    if (!verifiedEmail) {
      const recentVerification = await authRepository.findRecentlyConsumedCompanySignupOtp(
        adminEmail,
        COMPANY_SIGNUP_EMAIL_VERIFICATION_TTL_MS,
      );
      if (recentVerification) {
        verifiedEmail = adminEmail;
      }
    }

    if (!verifiedEmail || verifiedEmail !== adminEmail) {
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

    const contactName = payload.contactName || payload.companyName || 'Admin';
    const contactEmail = payload.contactEmail || adminEmail;
    const officialCompanyAddress = payload.officialCompanyAddress || payload.companyAddress.fullAddress || '';

    const autoApproveSetting = await prisma.systemSetting.findUnique({
      where: { key: 'auto_approve_company' },
    });
    const isAutoApproveEnabled = autoApproveSetting?.value === 'true';

    if (isAutoApproveEnabled) {
      let tenantSlug = payload.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      if (!tenantSlug) {
        tenantSlug = 'tenant';
      }
      const slugTaken = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
      });
      if (slugTaken) {
        tenantSlug = `${tenantSlug}-${Math.random().toString(36).substring(2, 6)}`;
      }

      const firstSuperAdmin = await prisma.superAdmin.findFirst();
      const superAdminId = firstSuperAdmin?.id || 'system-auto-approve';

      const request = await authRepository.createCompanyRegistrationRequest({
        ...rest,
        contactName,
        contactEmail,
        officialCompanyAddress,
        adminEmail,
        adminPasswordHash,
      });

      const permissionKeys = Object.values(PERMISSIONS) as string[];
      await authRepository.approveCompanyRegistrationRequest(request.id, permissionKeys, {
        tenantSlug,
        adminEmail,
        adminPasswordHash,
        reviewedBySuperAdminId: superAdminId,
        reviewNotes: 'System auto-approved company registration.',
      });

      void sendCompanyApprovalEmail({
        companyName: payload.companyName,
        toEmail: adminEmail,
        tenantSlug,
        username: adminEmail,
      }).catch((err) => console.error('Failed to send auto-approval email:', err));

      return {
        requestId: request.id,
        status: 'approved',
        tenantSlug,
        message: 'Company registration auto-approved successfully!',
      };
    }

    const request = await authRepository.createCompanyRegistrationRequest({
      ...rest,
      contactName,
      contactEmail,
      officialCompanyAddress,
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
      // Check if this email has a pending company registration request
      const pendingRequest = await prisma.companyRegistrationRequest.findFirst({
        where: {
          adminEmail: email,
          status: { in: ['pending', 'approved' as any] } // Use lowercase as per schema
        }
      });

      if (pendingRequest) {
        throw new AppError(
          'Your company registration is pending approval. You will receive an email once approved.',
          StatusCodes.FORBIDDEN,
          ERROR_CODES.APPROVAL_PENDING
        );
      }

      const rejectedRequest = await prisma.companyRegistrationRequest.findFirst({
        where: { adminEmail: email, status: 'rejected' }
      });

      if (rejectedRequest) {
        throw new AppError(
          'Your company registration request was not approved. Please contact support.',
          StatusCodes.FORBIDDEN,
          ERROR_CODES.APPROVAL_REJECTED
        );
      }

      const superAdminExists = await prisma.superAdmin.findUnique({
        where: { email }
      });
      if (superAdminExists) {
        throw new AppError(
          'This email is registered as a super admin account. Please use the super admin login portal instead.',
          StatusCodes.FORBIDDEN,
          ERROR_CODES.WRONG_PORTAL
        );
      }

      throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    // If user found but belongs to candidate tenant — wrong portal
    if (user.tenant.slug === (process.env.CANDIDATE_TENANT_SLUG ?? 'kofeko-candidates')) {
      throw new AppError(
        'This email is registered as a candidate account. Please use the candidate login instead.',
        StatusCodes.FORBIDDEN,
        ERROR_CODES.WRONG_PORTAL
      );
    }

    if (user.tenant.status === 'suspended') {
      throw new AppError('This account has been suspended. Contact support.', StatusCodes.FORBIDDEN, ERROR_CODES.TENANT_SUSPENDED);
    }

    if (user.status === UserStatus.suspended) {
      throw new AppError(
        'Your account has been suspended. Contact your company admin.',
        StatusCodes.FORBIDDEN,
        ERROR_CODES.USER_SUSPENDED
      );
    }

    if (user.status !== UserStatus.active && user.status !== UserStatus.invited) {
      throw new AppError(
        'Your account is not active. Contact your company admin.',
        StatusCodes.FORBIDDEN,
        ERROR_CODES.FORBIDDEN
      );
    }

    const isPasswordValid = await comparePassword(payload.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    if (user.status === UserStatus.invited) {
      const acceptedInvite = await authRepository.hasUserAcceptedInvite(user.id, user.tenantId);
      if (acceptedInvite) {
        throw new AppError(
          'Your account is pending approval. Contact your company admin to restore access.',
          StatusCodes.FORBIDDEN,
          ERROR_CODES.ACCOUNT_PENDING,
        );
      }
      throw new AppError(
        'Please accept your invitation first. Check your email for the invite link to set your password.',
        StatusCodes.FORBIDDEN,
        ERROR_CODES.ACCOUNT_INVITED_ONLY,
      );
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
    const email = payload.email.trim().toLowerCase();

    // Verify email token
    let verifiedEmail: string;
    try {
      verifiedEmail = verifyCandidateSignupEmailToken(payload.emailVerificationToken).email;
    } catch {
      throw new AppError(
        'Verify your email with the code we sent before creating an account.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    if (verifiedEmail !== email) {
      throw new AppError(
        'Email verification does not match the email on this form.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

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

    await this.ensureCandidateRecord(hydratedUser);

    const tokenPayload = {
      sub: hydratedUser.id,
      tenantId: tenant.id,
      email: hydratedUser.email,
      type: 'candidate' as const,
    };

    const accessToken = signCandidateAccessToken(tokenPayload);
    const refreshToken = signCandidateRefreshToken(tokenPayload);

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
      const email = payload.email.trim().toLowerCase();
      const superAdminExists = await prisma.superAdmin.findUnique({
        where: { email }
      });
      if (superAdminExists) {
        throw new AppError(
          'This email is registered as a super admin account. Please use the super admin login portal instead.',
          StatusCodes.FORBIDDEN,
          ERROR_CODES.WRONG_PORTAL
        );
      }

      const staffUser = await prisma.user.findFirst({
        where: {
          email,
          tenant: { slug: { not: candidateTenantSlug } }
        }
      });
      if (staffUser) {
        throw new AppError(
          'This email is registered as a company account. Please use the company login instead.',
          StatusCodes.FORBIDDEN,
          ERROR_CODES.WRONG_PORTAL
        );
      }

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
      type: 'candidate' as const,
    };
    const accessToken = signCandidateAccessToken(tokenPayload);
    const refreshToken = signCandidateRefreshToken(tokenPayload);

    await authRepository.createSession({
      tenantId: user.tenantId,
      userId: user.id,
      refreshTokenHash: createTokenHash(refreshToken),
      userAgent,
      ipAddress,
      expiresAt: getRefreshExpiryDate(),
    });

    await this.ensureCandidateRecord(user);

    return {
      accessToken,
      refreshToken,
      user: formatAuthUser(user),
      tenant: user.tenant,
    };
  },

  async ensureCandidateRecord(user: any) {
    const existing = await prisma.candidate.findUnique({
      where: { id: user.id },
    });
    if (!existing) {
      await prisma.candidate.create({
        data: {
          id: user.id,
          tenantId: user.tenantId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          status: 'new',
        },
      });
    }
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

    if (!user) {
      throw new AppError('User not found', StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }

    if (user.status !== UserStatus.active) {
      throw new AppError('User is not active', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN);
    }

    const tokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      type: 'candidate' as const,
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

    await this.ensureCandidateRecord(user);

    return {
      accessToken,
      refreshToken,
      user: await this.me(user.id, user.tenantId),
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

    if (!user) {
      throw new AppError('User not found', StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }

    if (user.status !== UserStatus.active) {
      throw new AppError('User is not active', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN);
    }

    const tokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      type: 'candidate' as const,
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

    await this.ensureCandidateRecord(user);

    return {
      accessToken,
      refreshToken,
      user: await this.me(user.id, user.tenantId),
      tenant: user.tenant,
    };
  },

  async refreshToken(payload: RefreshTokenInput) {
    let decoded: ReturnType<typeof verifyRefreshToken>;
    try {
      decoded = verifyRefreshToken(payload.refreshToken);
    } catch {
      throw new AppError('Invalid or expired token', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }
    const refreshTokenHash = createTokenHash(payload.refreshToken);

    const session = await authRepository.findValidSession(decoded.sub, decoded.tenantId, refreshTokenHash);

    if (!session) {
      throw new AppError('Invalid refresh token', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    const newAccessToken = signAccessToken({
      sub: decoded.sub,
      tenantId: decoded.tenantId,
      email: decoded.email,
      type: decoded.type,
    });

    return { accessToken: newAccessToken };
  },

  async me(userId: string, tenantId: string) {
    const cacheKey = cacheKeys.staffSession(tenantId, userId);
    return cacheService.getOrSet(cacheKey, CACHE_SESSION_TTL, async () => {
      const user = await authRepository.findUserByIdAndTenant(userId, tenantId);

      if (!user) {
        throw new AppError('User not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
      }

      let candidate = null;
      const roles = (user.userRoles ?? []).map((ur: any) => ur.role?.name);
      if (roles.includes('candidate')) {
        candidate = await prisma.candidate.findUnique({
          where: { id: userId },
        });
      }

      return formatAuthUser(user, candidate);
    });
  },

  async updateProfile(userId: string, tenantId: string, payload: UpdateStaffProfileInput) {
    const user = await authRepository.findUserByIdAndTenant(userId, tenantId);

    if (!user) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const updateData: UpdateStaffProfileInput = {};
    if (payload.firstName !== undefined) updateData.firstName = payload.firstName.trim();
    if (payload.lastName !== undefined) updateData.lastName = payload.lastName.trim();

    if (Object.keys(updateData).length > 0) {
      await userRepository.updateByIdAndTenant(userId, tenantId, updateData);
      await cacheService.invalidateStaffSession(tenantId, userId);
    }

    return this.me(userId, tenantId);
  },

  async logout(refreshToken: string): Promise<void> {
    const decoded = verifyRefreshToken(refreshToken);
    const refreshTokenHash = createTokenHash(refreshToken);

    const session = await authRepository.findValidSession(decoded.sub, decoded.tenantId, refreshTokenHash);

    if (!session) {
      return;
    }

    await authRepository.revokeSession(session.id);
    await cacheService.invalidateStaffSession(decoded.tenantId, decoded.sub);
  },

  async acceptInvite(payload: AcceptInviteInput) {
    const tokenHash = createTokenHash(payload.token);
    const inviteToken = await authRepository.findInviteTokenByToken(tokenHash);

    if (!inviteToken) {
      throw new AppError(
        'Invalid invite link. Request a new invitation from your admin.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.INVITE_TOKEN_INVALID
      );
    }

    if (inviteToken.usedAt) {
      throw new AppError(
        'This invite link has already been used. Try logging in, or ask your admin to resend.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.INVITE_TOKEN_USED
      );
    }

    if (inviteToken.expiresAt.getTime() < Date.now()) {
      throw new AppError(
        'This invite link has expired (valid for 72 hours). Ask your admin to send a new invitation.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.INVITE_TOKEN_EXPIRED
      );
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
    let tenantId: string | undefined;
    let userId: string | undefined;
    let userEmail = payload.email;
    let userName = 'User';

    if (!payload.tenantSlug) {
      const user = await prisma.user.findFirst({
        where: { email: payload.email },
      });
      if (user) {
        tenantId = user.tenantId;
        userId = user.id;
        userName = `${user.firstName} ${user.lastName}`.trim();
      }
    } else {
      const tenant = await authRepository.findTenantBySlug(payload.tenantSlug);
      if (tenant) {
        tenantId = tenant.id;
        const user = await authRepository.findUserByTenantAndEmail(tenant.id, payload.email);
        if (user) {
          userId = user.id;
          userName = `${user.firstName} ${user.lastName}`.trim();
          userId = user.id;
        }
      }
    }

    if (!tenantId || !userId) {
      return;
    }

    const rawToken = generateResetToken();
    const tokenHash = createTokenHash(rawToken);

    await authRepository.createPasswordResetToken({
      tenantId,
      userId,
      token: tokenHash,
      expiresAt: getResetTokenExpiryDate(),
    });

    const resetLink = `${env.APP_FRONTEND_URL}/reset-password?token=${rawToken}`;

    await sendEmail({
      to: userEmail,
      subject: 'Reset your Kofeko password',
      html: passwordResetEmailTemplate({
        resetLink,
        userName,
      }),
    });

    await auditService.createAuditLog({
      tenantId,
      actorId: userId,
      action: 'create',
      entityType: 'password_reset',
      entityId: userId,
      metadata: {
        email: userEmail,
      },
    });
  },

  async resetPassword(payload: ResetPasswordInput): Promise<void> {
    const tokenHash = createTokenHash(payload.token);
    const resetToken = await authRepository.findPasswordResetTokenByToken(tokenHash);

    if (!resetToken) {
      throw new AppError(
        'Invalid reset link. Request a new password reset from the login page.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.RESET_TOKEN_INVALID
      );
    }

    if (resetToken.usedAt) {
      throw new AppError(
        'This reset link has already been used. Request a new password reset if needed.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.RESET_TOKEN_USED
      );
    }

    if (resetToken.expiresAt.getTime() < Date.now()) {
      throw new AppError(
        'This reset link has expired (valid for 1 hour). Request a new password reset.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.RESET_TOKEN_EXPIRED
      );
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
