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
  UpdateStaffProfileInput,
} from '../../types/auth/auth.payloads';
import { uploadFile } from '../../common/storage/fileUpload';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';

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

export const sendCompanySignupEmailOtp = catchAsync(async (req: Request, res: Response) => {
  const { email } = getRequestBody<{ email: string }>(req);
  const result = await authService.sendCompanySignupEmailOtp({ email });
  sendSuccess(res, StatusCodes.OK, 'Verification code sent', result);
});

export const verifyCompanySignupEmailOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, code } = getRequestBody<{ email: string; code: string }>(req);
  const result = await authService.verifyCompanySignupEmailOtp({ email, code });
  sendSuccess(res, StatusCodes.OK, 'Email verified', result);
});

export const sendCandidateSignupEmailOtp = catchAsync(async (req: Request, res: Response) => {
  const { email } = getRequestBody<{ email: string }>(req);
  const result = await authService.sendCandidateSignupEmailOtp({ email });
  sendSuccess(res, StatusCodes.OK, 'Verification code sent', result);
});

export const verifyCandidateSignupEmailOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, code } = getRequestBody<{ email: string; code: string }>(req);
  const result = await authService.verifyCandidateSignupEmailOtp({ email, code });
  sendSuccess(res, StatusCodes.OK, 'Email verified', result);
});

export const verifyCandidatePhoneOtpMsg91 = catchAsync(async (req: Request, res: Response) => {
  const { accessToken } = getRequestBody<{ accessToken: string }>(req);
  const result = await authService.verifyCandidatePhoneOtpMsg91({ accessToken });
  sendSuccess(res, StatusCodes.OK, 'Phone verified via MSG91', result);
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

export const loginCandidateWithGoogle = catchAsync(async (req: Request, res: Response) => {
  const { ip, headers } = req;
  const userAgent = optionalStringValue(headers['user-agent']);
  const payload = getRequestBody<{ idToken: string }>(req);
  const result = await authService.loginCandidateWithGoogle(payload, userAgent, ip);

  sendSuccess(res, StatusCodes.OK, 'Candidate login successful', result);
});

export const loginCandidateWithSupabase = catchAsync(async (req: Request, res: Response) => {
  const { ip, headers } = req;
  const userAgent = optionalStringValue(headers['user-agent']);
  const payload = getRequestBody<{ accessToken: string }>(req);
  const result = await authService.loginCandidateWithSupabase(payload, userAgent, ip);

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

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const { user } = req;
  const payload = getRequestBody<UpdateStaffProfileInput>(req);
  const result = await authService.updateProfile(String(user?.userId), String(user?.tenantId), payload);
  sendSuccess(res, StatusCodes.OK, 'Profile updated successfully', result);
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

export const uploadPublicLogo = catchAsync(async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    throw new AppError('Logo file is required', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }

  const allowed = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/svg',
    'image/jpg',
  ]);

  const filenameLower = file.originalname.toLowerCase();
  const isSvg = filenameLower.endsWith('.svg');
  const isImg = filenameLower.endsWith('.jpg') || filenameLower.endsWith('.jpeg') || filenameLower.endsWith('.png') || filenameLower.endsWith('.gif') || filenameLower.endsWith('.webp');

  if (!allowed.has(file.mimetype) && !isSvg && !isImg) {
    throw new AppError('Unsupported format. Use JPG, PNG, GIF, WEBP or SVG.', StatusCodes.UNSUPPORTED_MEDIA_TYPE, ERROR_CODES.VALIDATION_ERROR);
  }

  const maxBytes = 5 * 1024 * 1024; // 5MB for logo
  if (file.size > maxBytes) {
    throw new AppError('File is too large (max 5 MB).', StatusCodes.REQUEST_TOO_LONG, ERROR_CODES.VALIDATION_ERROR);
  }

  let mimeType = file.mimetype;
  if (isSvg && mimeType !== 'image/svg+xml') {
    mimeType = 'image/svg+xml';
  } else if ((filenameLower.endsWith('.jpg') || filenameLower.endsWith('.jpeg')) && !['image/jpeg', 'image/jpg'].includes(mimeType)) {
    mimeType = 'image/jpeg';
  } else if (filenameLower.endsWith('.png') && mimeType !== 'image/png') {
    mimeType = 'image/png';
  }

  const url = await uploadFile(file.buffer, file.originalname, mimeType);
  sendSuccess(res, StatusCodes.OK, 'Logo uploaded successfully', {
    url,
    mimeType,
    filename: file.originalname,
  });
});
