import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendPaginated, sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { superAdminService } from '../../services/superadmin/superadmin.service';
import { tenantManagementService } from '../../services/superadmin/tenantManagement.service';
import { platformAnalyticsService } from '../../services/superadmin/platformAnalytics.service';
import { companyRegistrationManagementService } from '../../services/superadmin/companyRegistrationManagement.service';
import { requireStringValue } from '../../common/utils/requestValue';
import { CompanyRegistrationStatus, TenantStatus } from '@prisma/client';
import { parsePagination } from '../../common/utils/pagination';

export const superAdminBootstrap = catchAsync(async (req: Request, res: Response) => {
  const setupKey = String(req.header('x-setup-key') ?? '');
  const payload = getRequestBody<{ email: string; password: string; firstName: string; lastName: string }>(req);
  const result = await superAdminService.bootstrap(payload, setupKey);
  sendSuccess(res, StatusCodes.CREATED, 'Super admin bootstrapped', result);
});

export const superAdminLogin = catchAsync(async (req: Request, res: Response) => {
  const payload = getRequestBody<{ email: string; password: string }>(req);
  const userAgent = req.header('user-agent') ?? undefined;
  const ipAddress = req.ip;
  const result = await superAdminService.login(payload.email, payload.password, userAgent, ipAddress);
  sendSuccess(res, StatusCodes.OK, 'Super admin login successful', result);
});

export const superAdminRefresh = catchAsync(async (req: Request, res: Response) => {
  const payload = getRequestBody<{ refreshToken: string }>(req);
  const result = await superAdminService.refresh(payload.refreshToken);
  sendSuccess(res, StatusCodes.OK, 'Access token refreshed', result);
});

export const superAdminLogout = catchAsync(async (req: Request, res: Response) => {
  const payload = getRequestBody<{ refreshToken: string }>(req);
  await superAdminService.logout(payload.refreshToken);
  sendSuccess(res, StatusCodes.OK, 'Logged out', null);
});

export const superAdminMe = catchAsync(async (req: Request, res: Response) => {
  const superAdminId = req.superAdmin?.superAdminId;
  const result = await superAdminService.me(String(superAdminId));
  sendSuccess(res, StatusCodes.OK, 'Super admin profile fetched', result);
});

export const superAdminUpdateProfile = catchAsync(async (req: Request, res: Response) => {
  const superAdminId = String(req.superAdmin?.superAdminId);
  const payload = getRequestBody<{ currentPassword: string; email?: string; newPassword?: string }>(req);
  const result = await superAdminService.updateProfile(superAdminId, payload);
  sendSuccess(res, StatusCodes.OK, 'Super admin profile updated', result);
});

export const superAdminListTenants = catchAsync(async (req: Request, res: Response) => {
  const statusParam = req.query.status as string | undefined;
  const status = statusParam ? (statusParam as TenantStatus) : undefined;
  const search = (req.query.search as string | undefined) ?? undefined;
  const pagination = parsePagination(req.query.page, req.query.limit);

  const result = await tenantManagementService.listTenants({
    status,
    search,
    page: pagination.page,
    limit: pagination.limit,
  });
  sendPaginated(res, StatusCodes.OK, {
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});

export const superAdminGetTenant = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringValue(req.params.id, 'id');
  const result = await tenantManagementService.getTenantById(id);
  sendSuccess(res, StatusCodes.OK, 'Tenant fetched', result);
});

export const superAdminSuspendTenant = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringValue(req.params.id, 'id');
  const payload = getRequestBody<{ reason: string }>(req);
  const superAdminId = String(req.superAdmin?.superAdminId);
  const result = await tenantManagementService.suspendTenant(id, payload.reason, superAdminId);
  sendSuccess(res, StatusCodes.OK, 'Tenant suspended', result);
});

export const superAdminActivateTenant = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringValue(req.params.id, 'id');
  const superAdminId = String(req.superAdmin?.superAdminId);
  const result = await tenantManagementService.activateTenant(id, superAdminId);
  sendSuccess(res, StatusCodes.OK, 'Tenant activated', result);
});

export const superAdminPlatformAnalytics = catchAsync(async (_req: Request, res: Response) => {
  const result = await platformAnalyticsService.getPlatformSummary();
  sendSuccess(res, StatusCodes.OK, 'Platform analytics fetched', result);
});

export const superAdminListCompanyRequests = catchAsync(async (req: Request, res: Response) => {
  const statusParam = req.query.status as string | undefined;
  const allowed: CompanyRegistrationStatus[] = ['pending', 'approved', 'rejected'];
  const filter =
    statusParam && allowed.includes(statusParam as CompanyRegistrationStatus)
      ? { status: statusParam as CompanyRegistrationStatus }
      : undefined;

  const result = await companyRegistrationManagementService.listRequests(filter);
  sendSuccess(res, StatusCodes.OK, 'Company registration requests fetched', result);
});

export const superAdminApproveCompanyRequest = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringValue(req.params.id, 'id');
  const payload = getRequestBody<{
    tenantSlug: string;
    reviewNotes?: string;
    adminEmail?: string;
    adminPassword?: string;
  }>(req);
  const superAdminId = String(req.superAdmin?.superAdminId);
  const result = await companyRegistrationManagementService.approveRequest(id, payload, superAdminId);
  sendSuccess(res, StatusCodes.OK, result.message, result);
});

export const superAdminRejectCompanyRequest = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringValue(req.params.id, 'id');
  const payload = getRequestBody<{ reviewNotes: string }>(req);
  const superAdminId = String(req.superAdmin?.superAdminId);
  const result = await companyRegistrationManagementService.rejectRequest(id, payload.reviewNotes, superAdminId);
  sendSuccess(res, StatusCodes.OK, result.message, result);
});
