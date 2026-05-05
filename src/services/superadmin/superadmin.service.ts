import { CompanyRegistrationStatus, Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { signSuperAdminToken } from '../../common/auth/superadminJwt';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { prisma } from '../../config/prisma';
import { hashPassword } from '../../common/auth/password';
import { authRepository } from '../../repositories/auth/auth.repository';
import { PERMISSIONS } from '../../common/constants/permissions';
import { sendCompanyApprovalEmail } from '../email/approval-email.service';

const splitContactName = (fullName: string) => {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return {
    firstName: firstName || 'Admin',
    lastName: rest.join(' ') || 'User',
  };
};

export const superAdminService = {
  async login(username: string, password: string) {
    if (username !== env.SUPERADMIN_USERNAME || password !== env.SUPERADMIN_PASSWORD) {
      throw new AppError('Invalid superadmin credentials', StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    return {
      accessToken: signSuperAdminToken(username),
      username,
    };
  },

  async listRequests(status?: CompanyRegistrationStatus) {
    return prisma.companyRegistrationRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  },

  async approveRequest(
    requestId: string,
    payload: { tenantSlug: string; adminEmail: string; adminPassword: string; otp: string; reviewNotes?: string },
  ) {
    const request = await prisma.companyRegistrationRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new AppError('Registration request not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    if (request.status !== CompanyRegistrationStatus.pending) {
      throw new AppError('Only pending requests can be approved', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const existingTenant = await prisma.tenant.findUnique({ where: { slug: payload.tenantSlug } });
    if (existingTenant) {
      throw new AppError('Tenant slug already exists', StatusCodes.CONFLICT, ERROR_CODES.CONFLICT);
    }

    const passwordHash = await hashPassword(payload.adminPassword);
    const otpHash = await hashPassword(payload.otp);
    const { firstName, lastName } = splitContactName(request.contactName);

    const { tenant, user } = await authRepository.bootstrapTenantAdmin({
      tenantName: request.companyName,
      tenantSlug: payload.tenantSlug,
      firstName,
      lastName,
      email: payload.adminEmail,
      passwordHash,
      permissionKeys: Object.values(PERMISSIONS),
    });

    const company = await prisma.company.create({
      data: {
        companyName: request.companyName,
        companyAddress: request.companyAddress as Prisma.InputJsonValue,
        industry: request.industry,
        companySize: request.companySize,
        companyType: request.companyType,
        foundedYear: request.foundedYear,
        companyWebsite: request.companyWebsite,
        officialCompanyAddress: request.officialCompanyAddress,
        phoneNumber: request.phoneNumber,
        companyLogo: request.companyLogo,
        shortDescription: request.shortDescription,
        linkedinUrl: request.linkedinUrl,
        twitterUrl: request.twitterUrl,
        termsAccepted: request.termsAccepted,
      },
    });

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { companyId: company.id },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpRequired: true,
        loginOtpHash: otpHash,
        loginOtpExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await prisma.companyRegistrationRequest.update({
      where: { id: request.id },
      data: {
        status: CompanyRegistrationStatus.approved,
        reviewedBy: env.SUPERADMIN_USERNAME,
        reviewNotes: payload.reviewNotes,
        approvedTenantId: tenant.id,
      },
    });

    const mailSent = await sendCompanyApprovalEmail({
      companyName: request.companyName,
      toEmail: request.contactEmail,
      tenantSlug: tenant.slug,
      username: payload.adminEmail,
      password: payload.adminPassword,
      otp: payload.otp,
    });

    return {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      adminEmail: payload.adminEmail,
      otpRequired: true,
      mailSent,
      message: mailSent
        ? 'Company approved, credentials issued, and approval email sent'
        : 'Company approved and credentials issued, but email could not be sent (SMTP not configured)',
    };
  },

  async rejectRequest(requestId: string, reviewNotes: string) {
    const request = await prisma.companyRegistrationRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new AppError('Registration request not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    if (request.status !== CompanyRegistrationStatus.pending) {
      throw new AppError('Only pending requests can be rejected', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    return prisma.companyRegistrationRequest.update({
      where: { id: requestId },
      data: {
        status: CompanyRegistrationStatus.rejected,
        reviewedBy: env.SUPERADMIN_USERNAME,
        reviewNotes,
      },
    });
  },
};
