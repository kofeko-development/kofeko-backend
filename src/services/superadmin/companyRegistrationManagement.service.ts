import { hashPassword } from '../../common/auth/password';
import { PERMISSIONS } from '../../common/constants/permissions';
import { authRepository } from '../../repositories/auth/auth.repository';
import { sendCompanyApprovalEmail } from '../email/approval-email.service';

import { CompanyRegistrationStatus } from '@prisma/client';

const OTP_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;

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
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  },

  async approveRequest(
    requestId: string,
    body: { tenantSlug: string; adminEmail: string; adminPassword: string; otp: string; reviewNotes?: string },
    superAdminId: string,
  ) {
    const tenantSlug = body.tenantSlug.trim().toLowerCase();
    const adminEmailNorm = body.adminEmail.trim().toLowerCase();

    const adminPasswordHash = await hashPassword(body.adminPassword);
    const loginOtpHash = await hashPassword(body.otp);
    const loginOtpExpiresAt = new Date(Date.now() + OTP_VALIDITY_MS);

    const permissionKeys = Object.values(PERMISSIONS) as string[];

    const { tenant } = await authRepository.approveCompanyRegistrationRequest(requestId, permissionKeys, {
      tenantSlug,
      adminEmail: adminEmailNorm,
      adminPasswordHash,
      loginOtpHash,
      loginOtpExpiresAt,
      reviewedBySuperAdminId: superAdminId,
      reviewNotes: body.reviewNotes,
    });

    const registration = await authRepository.findCompanyRegistrationRequestById(requestId);
    const companyName = registration?.companyName ?? tenant.name;

    void sendCompanyApprovalEmail({
      companyName,
      toEmail: adminEmailNorm,
      tenantSlug: tenant.slug,
      username: adminEmailNorm,
      password: body.adminPassword,
      otp: body.otp,
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
