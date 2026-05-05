import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { requireStringValue } from '../../common/utils/requestValue';
import { superAdminService } from '../../services/superadmin/superadmin.service';
import { CompanyRegistrationStatus } from '@prisma/client';

export const superAdminLogin = catchAsync(async (req: Request, res: Response) => {
  const payload = getRequestBody<{ username: string; password: string }>(req);
  const result = await superAdminService.login(payload.username, payload.password);
  sendSuccess(res, StatusCodes.OK, 'Superadmin login successful', result);
});

export const listCompanyRequests = catchAsync(async (req: Request, res: Response) => {
  const statusParam = req.query.status as string | undefined;
  const allowed = ['pending', 'approved', 'rejected'];
  const status = allowed.includes(String(statusParam)) ? (statusParam as CompanyRegistrationStatus) : undefined;
  const result = await superAdminService.listRequests(status);
  sendSuccess(res, StatusCodes.OK, 'Company requests fetched', result);
});

export const approveCompanyRequest = catchAsync(async (req: Request, res: Response) => {
  const requestId = requireStringValue(req.params.id, 'id');
  const payload = getRequestBody<{
    tenantSlug: string;
    adminEmail: string;
    adminPassword: string;
    otp: string;
    reviewNotes?: string;
  }>(req);
  const result = await superAdminService.approveRequest(requestId, payload);
  sendSuccess(res, StatusCodes.OK, 'Company request approved', result);
});

export const rejectCompanyRequest = catchAsync(async (req: Request, res: Response) => {
  const requestId = requireStringValue(req.params.id, 'id');
  const payload = getRequestBody<{ reviewNotes: string }>(req);
  const result = await superAdminService.rejectRequest(requestId, payload.reviewNotes);
  sendSuccess(res, StatusCodes.OK, 'Company request rejected', result);
});
