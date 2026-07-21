import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { superAdminTwoFactorService } from '../../services/superadmin/superadmin-2fa.service';
import { superAdminService } from '../../services/superadmin/superadmin.service';

export const superAdminTwoFactorSetup = catchAsync(async (req: Request, res: Response) => {
  const superAdminId = String(req.superAdmin?.superAdminId);
  const result = await superAdminTwoFactorService.setup(superAdminId);
  sendSuccess(res, StatusCodes.OK, '2FA setup initiated', result);
});

export const superAdminTwoFactorVerify = catchAsync(async (req: Request, res: Response) => {
  const superAdminId = String(req.superAdmin?.superAdminId);
  const payload = getRequestBody<{ code: string }>(req);
  const result = await superAdminTwoFactorService.verifySetup(superAdminId, payload.code);
  sendSuccess(res, StatusCodes.OK, 'Two-factor authentication enabled', result);
});

export const superAdminTwoFactorDisable = catchAsync(async (req: Request, res: Response) => {
  const superAdminId = String(req.superAdmin?.superAdminId);
  const payload = getRequestBody<{ code: string }>(req);
  await superAdminTwoFactorService.disable(superAdminId, payload.code);
  sendSuccess(res, StatusCodes.OK, 'Two-factor authentication disabled', null);
});

export const superAdminTwoFactorStatus = catchAsync(async (req: Request, res: Response) => {
  const superAdminId = String(req.superAdmin?.superAdminId);
  const result = await superAdminTwoFactorService.status(superAdminId);
  sendSuccess(res, StatusCodes.OK, '2FA status fetched', result);
});

export const superAdminLogin2FAVerify = catchAsync(async (req: Request, res: Response) => {
  const payload = getRequestBody<{ pendingToken: string; code: string }>(req);
  const userAgent = req.header('user-agent') ?? undefined;
  const ipAddress = req.ip;
  const result = await superAdminService.verifyLogin2FA(
    payload.pendingToken,
    payload.code,
    userAgent,
    ipAddress,
  );
  sendSuccess(res, StatusCodes.OK, 'Super admin login successful', result);
});
