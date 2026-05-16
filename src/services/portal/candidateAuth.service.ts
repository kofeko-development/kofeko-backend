import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { prisma } from '../../config/prisma';
import { comparePassword, hashPassword } from '../../common/auth/password';
import { signCandidateAccessToken, signCandidateRefreshToken, verifyCandidateRefreshToken } from '../../common/auth/candidate.jwt';
import { communicationService } from '../communication/communication.service';
import { candidateWelcomeEmail } from '../../common/email/templates/candidateWelcomeEmail';
import { env } from '../../config/env';

const ensureActiveTenantBySlug = async (tenantSlug: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, name: true, status: true, slug: true },
  });
  if (!tenant) {
    throw new AppError('Company not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }
  if (tenant.status !== 'active') {
    throw new AppError('This account has been suspended. Contact support.', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN);
  }
  return tenant;
};

export const candidateAuthService = {
  async register(payload: {
    tenantSlug: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    const tenant = await ensureActiveTenantBySlug(payload.tenantSlug);

    const existing = await prisma.candidate.findFirst({
      where: { tenantId: tenant.id, email: payload.email },
      select: { id: true, passwordHash: true },
    });
    if (existing) {
      if (!existing.passwordHash) {
        throw new AppError(
          'An account exists for this email but needs to be activated. Check your email for an invitation link.',
          StatusCodes.CONFLICT,
          ERROR_CODES.ACCOUNT_INVITED_ONLY
        );
      }
      throw new AppError(
        'An account with this email already exists. Please sign in instead.',
        StatusCodes.CONFLICT,
        ERROR_CODES.CONFLICT
      );
    }

    const passwordHash = await hashPassword(payload.password);
    const created = await prisma.candidate.create({
      data: {
        tenantId: tenant.id,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        passwordHash,
        emailVerified: false,
        status: 'new',
      },
      select: {
        id: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    try {
      const { subject, html } = candidateWelcomeEmail({
        candidateName: `${created.firstName} ${created.lastName}`.trim(),
        companyName: tenant.name,
        portalUrl: `${env.FRONTEND_URL}/portal/${tenant.slug}`,
      });

      await communicationService.sendManualMessage(tenant.id, { to: created.email, subject, html });
    } catch {
      // fire-and-forget
    }

    return {
      id: created.id,
      firstName: created.firstName,
      lastName: created.lastName,
      email: created.email,
      tenantId: created.tenantId,
      summary: null,
      education: [],
      workExperience: [],
      projects: [],
      hobbies: [],
      skills: [],
    };
  },

  async login(tenantSlug: string, email: string, password: string) {
    const tenant = await ensureActiveTenantBySlug(tenantSlug);

    const candidate = await prisma.candidate.findFirst({
      where: { tenantId: tenant.id, email },
      select: { id: true, tenantId: true, firstName: true, lastName: true, email: true, passwordHash: true },
    });
    if (!candidate) {
      throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    if (!candidate.passwordHash) {
      throw new AppError(
        'This account was created by the recruiting team. Check your email for an invite link to set your password.',
        StatusCodes.FORBIDDEN,
        ERROR_CODES.ACCOUNT_NO_PASSWORD,
      );
    }

    const ok = await comparePassword(password, candidate.passwordHash);
    if (!ok) {
      throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { lastLoginAt: new Date() },
    });

    const jwtPayload = { sub: candidate.id, tenantId: tenant.id, type: 'candidate' as const };
    const fullCandidate = await this.me(candidate.id, tenant.id);

    return {
      accessToken: signCandidateAccessToken(jwtPayload),
      refreshToken: signCandidateRefreshToken(jwtPayload),
      candidate: {
        id: fullCandidate.id,
        firstName: fullCandidate.firstName,
        lastName: fullCandidate.lastName,
        email: fullCandidate.email,
        phoneNumber: fullCandidate.phoneNumber,
        resumeUrl: fullCandidate.resumeUrl,
        summary: fullCandidate.summary,
        education: fullCandidate.education,
        workExperience: fullCandidate.workExperience,
        projects: fullCandidate.projects,
        hobbies: fullCandidate.hobbies,
        skills: fullCandidate.skills,
        linkedinUrl: fullCandidate.linkedinUrl,
      },
    };
  },

  async refresh(refreshToken: string) {
    const decoded = verifyCandidateRefreshToken(refreshToken);
    if (decoded.type !== 'candidate') {
      throw new AppError('Invalid refresh token', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: decoded.tenantId }, select: { status: true } });
    if (!tenant || tenant.status !== 'active') {
      throw new AppError('This account has been suspended. Contact support.', StatusCodes.FORBIDDEN, ERROR_CODES.FORBIDDEN);
    }

    const accessToken = signCandidateAccessToken({ sub: decoded.sub, tenantId: decoded.tenantId, type: 'candidate' });
    return { accessToken };
  },

  async me(candidateId: string, tenantId: string) {
    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, tenantId },
      select: {
        id: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        resumeUrl: true,
        resumeMimeType: true,
        linkedinUrl: true,
        portfolioUrl: true,
        expectedSalary: true,
        noticePeriod: true,
        skills: true,
        location: true,
        summary: true,
        education: true,
        workExperience: true,
        projects: true,
        hobbies: true,
        yearsOfExperience: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!candidate) {
      throw new AppError('Candidate not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return candidate;
  },
};

