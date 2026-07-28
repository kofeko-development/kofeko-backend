import { StatusCodes } from 'http-status-codes';
import { hashPassword } from '../../common/auth/password';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { authRepository } from '../../repositories/auth/auth.repository';
import { sendCompanyApprovalEmail, sendCompanyRejectionEmail } from '../email/approval-email.service';
import { prisma } from '../../config/prisma';
import { CompanyRegistrationStatus, Tenant } from '@prisma/client';

export const companyRegistrationManagementService = {
  async listRequests(filter?: { status?: CompanyRegistrationStatus }) {
    const rows = await authRepository.listCompanyRegistrationRequests(filter);

    // Fetch related tenants to get restriction data
    const tenantIds = rows.map((r) => r.approvedTenantId).filter(Boolean) as string[];
    let tenants: Tenant[] = [];
    if (tenantIds.length > 0) {
      tenants = await prisma.tenant.findMany({ where: { id: { in: tenantIds } } });
    }
    const tenantMap = new Map(tenants.map(t => [t.id, t]));

    return rows.map((r) => {
      const tenant = r.approvedTenantId ? tenantMap.get(r.approvedTenantId) : null;
      return {
        id: r.id,
        companyName: r.companyName,
        companyAddress: r.companyAddress,
        industry: r.industry,
        companySize: r.companySize,
        companyType: r.companyType,
        foundedYear: r.foundedYear,
        companyWebsite: r.companyWebsite,
        officialCompanyAddress: r.officialCompanyAddress,
        phoneNumber: r.phoneNumber ?? '',
        companyLogo: r.companyLogo,
        shortDescription: r.shortDescription,
        linkedinUrl: r.linkedinUrl,
        twitterUrl: r.twitterUrl,
        termsAccepted: r.termsAccepted,
        contactName: r.contactName,
        contactEmail: r.contactEmail,
        adminEmail: r.adminEmail ?? '',
        usesSignupCredentials: Boolean(r.adminPasswordHash && r.adminEmail),
        status: r.status,
        approvedTenantId: r.approvedTenantId,
        tenantStatus: tenant?.status,
        suspendedUntil: tenant?.suspendedUntil?.toISOString(),
        createdAt: r.createdAt.toISOString(),
      };
    });
  },

  async approveRequest(
    requestId: string,
    body: {
      tenantSlug: string;
      reviewNotes?: string;
      adminEmail?: string;
      adminPassword?: string;
    },
    superAdminId: string,
  ) {
    const registration = await authRepository.findCompanyRegistrationRequestById(requestId);
    if (!registration) {
      throw new AppError('Company registration request not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const tenantSlug = body.tenantSlug.trim().toLowerCase();

    let adminEmailNorm: string;
    let adminPasswordHash: string;

    if (registration.adminPasswordHash && registration.adminEmail) {
      adminEmailNorm = registration.adminEmail.trim().toLowerCase();
      adminPasswordHash = registration.adminPasswordHash;
    } else {
      const email = body.adminEmail?.trim();
      const plainPassword = body.adminPassword;
      if (!email || !plainPassword) {
        throw new AppError(
          'Admin email and password are required to approve this legacy registration request.',
          StatusCodes.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
        );
      }
      adminEmailNorm = email.toLowerCase();
      adminPasswordHash = await hashPassword(plainPassword);
    }

    const permissionKeys = Object.values(PERMISSIONS) as string[];

    const { tenant } = await authRepository.approveCompanyRegistrationRequest(requestId, permissionKeys, {
      tenantSlug,
      adminEmail: adminEmailNorm,
      adminPasswordHash,
      reviewedBySuperAdminId: superAdminId,
      reviewNotes: body.reviewNotes,
    });

    const companyName = registration.companyName ?? tenant.name;
    const passwordFromSignup = Boolean(registration.adminPasswordHash && registration.adminEmail);

    void sendCompanyApprovalEmail({
      companyName,
      toEmail: adminEmailNorm,
      tenantSlug: tenant.slug,
      username: adminEmailNorm,
      password: passwordFromSignup ? undefined : body.adminPassword,
      message: body.reviewNotes,
    }).catch(() => undefined);

    return {
      message: 'Company approved; tenant and admin user created.',
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    };
  },

  async rejectRequest(requestId: string, reviewNotes: string, superAdminId: string) {
    const updated = await authRepository.rejectCompanyRegistrationRequest(requestId, {
      reviewNotes,
      reviewedBySuperAdminId: superAdminId,
    });
    const toEmail = updated.adminEmail || updated.contactEmail;
    if (toEmail) {
      void sendCompanyRejectionEmail({
        companyName: updated.companyName,
        toEmail,
        reason: reviewNotes,
      }).catch(() => undefined);
    }
    return { message: 'Registration request rejected.' };
  },
};
