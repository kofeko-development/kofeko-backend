import { StatusCodes } from 'http-status-codes';
import { hashPassword } from '../../common/auth/password';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { authRepository } from '../../repositories/auth/auth.repository';
import { sendCompanyApprovalEmail } from '../email/approval-email.service';

import { CompanyRegistrationStatus } from '@prisma/client';

export const companyRegistrationManagementService = {
  async listRequests(filter?: { status?: CompanyRegistrationStatus }) {
    const rows = await authRepository.listCompanyRegistrationRequests(filter);
    return rows.map((r) => ({
      id: r.id,
      companyName: r.companyName,
      companyType: r.companyType,
      companySize: r.companySize,
      industry: r.industry,
      contactName: r.contactName,
      contactEmail: r.contactEmail,
      phoneNumber: r.phoneNumber ?? '',
      adminEmail: r.adminEmail ?? '',
      usesSignupCredentials: Boolean(r.adminPasswordHash && r.adminEmail),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
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
    }).catch(() => undefined);

    return {
      message: 'Company approved; tenant and admin user created.',
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    };
  },

  async rejectRequest(requestId: string, reviewNotes: string, superAdminId: string) {
    await authRepository.rejectCompanyRegistrationRequest(requestId, {
      reviewNotes,
      reviewedBySuperAdminId: superAdminId,
    });
    return { message: 'Registration request rejected.' };
  },
};
