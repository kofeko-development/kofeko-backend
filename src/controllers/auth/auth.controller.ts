import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { optionalStringValue } from '../../common/utils/requestValue';
import { authService } from '../../services/auth/auth.service';
import {
  AcceptInviteInput,
  ForgotPasswordInput,
  LoginCandidateInput,
  LoginInput,
  RefreshTokenInput,
  RegisterAdminInput,
  RegisterCandidateInput,
  RegisterCompanyRequestInput,
  ResetPasswordInput,
} from '../../types/auth/auth.payloads';

export const registerAdmin = catchAsync(async (req: Request, res: Response) => {
  const { ip, headers } = req;
  const userAgent = optionalStringValue(headers['user-agent']);
  const registerAdminInput = getRequestBody<RegisterAdminInput>(req);
  const result = await authService.registerAdmin(registerAdminInput, userAgent, ip);

  sendSuccess(res, StatusCodes.CREATED, 'Tenant admin registered successfully', result);
});

export const registerCompanyRequest = catchAsync(async (req: Request, res: Response) => {
  const payload = getRequestBody<RegisterCompanyRequestInput>(req);
  const result = await authService.registerCompanyRequest(payload);
  sendSuccess(res, StatusCodes.CREATED, 'Company registration submitted successfully', result);
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { ip, headers } = req;
  const userAgent = optionalStringValue(headers['user-agent']);
  const loginInput = getRequestBody<LoginInput>(req);
  const result = await authService.login(loginInput, userAgent, ip);

  sendSuccess(res, StatusCodes.OK, 'Login successful', result);
});

export const registerCandidate = catchAsync(async (req: Request, res: Response) => {
  const { ip, headers } = req;
  const userAgent = optionalStringValue(headers['user-agent']);
  const registerCandidateInput = getRequestBody<RegisterCandidateInput>(req);
  const result = await authService.registerCandidate(registerCandidateInput, userAgent, ip);

  sendSuccess(res, StatusCodes.CREATED, 'Candidate registered successfully', result);
});

export const loginCandidate = catchAsync(async (req: Request, res: Response) => {
  const { ip, headers } = req;
  const userAgent = optionalStringValue(headers['user-agent']);
  const loginCandidateInput = getRequestBody<LoginCandidateInput>(req);
  const result = await authService.loginCandidate(loginCandidateInput, userAgent, ip);

  sendSuccess(res, StatusCodes.OK, 'Candidate login successful', result);
});

export const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const refreshTokenInput = getRequestBody<RefreshTokenInput>(req);
  const result = await authService.refreshToken(refreshTokenInput);

  sendSuccess(res, StatusCodes.OK, 'Access token refreshed', result);
});

export const me = catchAsync(async (req: Request, res: Response) => {
  const { user } = req;
  const result = await authService.me(String(user?.userId), String(user?.tenantId));
  sendSuccess(res, StatusCodes.OK, 'Current user profile', result);
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  const logoutInput = getRequestBody<RefreshTokenInput>(req);
  await authService.logout(logoutInput.refreshToken);

  sendSuccess(res, StatusCodes.OK, 'Logged out successfully', null);
});

export const acceptInvite = catchAsync(async (req: Request, res: Response) => {
  const input = getRequestBody<AcceptInviteInput>(req);
  const result = await authService.acceptInvite(input);

  sendSuccess(res, StatusCodes.OK, 'Invite accepted successfully', result);
});

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const input = getRequestBody<ForgotPasswordInput>(req);
  await authService.forgotPassword(input);

  sendSuccess(res, StatusCodes.OK, 'If an account exists, a reset email has been sent', null);
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const input = getRequestBody<ResetPasswordInput>(req);
  await authService.resetPassword(input);

  sendSuccess(res, StatusCodes.OK, 'Password reset successfully', null);
});
