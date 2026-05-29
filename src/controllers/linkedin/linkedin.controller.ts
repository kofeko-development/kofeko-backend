import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess, sendPaginated } from '../../common/utils/apiResponse';
import { parsePagination } from '../../common/utils/pagination';
import { getRequestBody } from '../../common/utils/requestBody';
import { requireStringValue } from '../../common/utils/requestValue';
import { mapOAuthCallbackError } from '../../common/linkedin/linkedinApiErrors';
import * as li from '../../services/linkedin/linkedin.service';

export const getPreview = catchAsync(async (req: Request, res: Response) => {
  const jobId = requireStringValue(req.params.jobId, 'jobId');
  const tenantId = String(req.user?.tenantId);
  const result = await li.getPreview(jobId, tenantId);
  sendSuccess(res, StatusCodes.OK, 'Post preview ready', result);
});

export const recordCopy = catchAsync(async (req: Request, res: Response) => {
  const { jobId, postText } = getRequestBody<{ jobId: string; postText: string }>(req);
  const tenantId = String(req.user?.tenantId);
  const userId = String(req.user?.userId);
  const result = await li.recordCopy(jobId, tenantId, userId, postText);
  sendSuccess(res, StatusCodes.CREATED, 'Copy recorded', result);
});

export const recordShare = catchAsync(async (req: Request, res: Response) => {
  const { jobId, postText, shareUrl } = getRequestBody<{
    jobId: string;
    postText: string;
    shareUrl: string;
  }>(req);
  const tenantId = String(req.user?.tenantId);
  const userId = String(req.user?.userId);
  const result = await li.recordShareOpen(jobId, tenantId, userId, postText, shareUrl);
  sendSuccess(res, StatusCodes.CREATED, 'Share recorded', result);
});

export const getAuthUrl = catchAsync(async (req: Request, res: Response) => {
  const userId = String(req.user?.userId);
  const tenantId = String(req.user?.tenantId);
  const url = li.getAuthorizationUrl(userId, tenantId);
  sendSuccess(res, StatusCodes.OK, 'LinkedIn authorization URL', { url });
});

export const handleCallback = catchAsync(async (req: Request, res: Response) => {
  const { code, state, error, error_description: errorDescription } = req.query as Record<
    string,
    string | undefined
  >;
  const frontendUrl = env.FRONTEND_URL;

  if (error) {
    const reason = mapOAuthCallbackError(error, errorDescription);
    return res.redirect(
      `${frontendUrl}/settings/integrations?linkedin=error&reason=${encodeURIComponent(reason)}`,
    );
  }
  if (!code || !state) {
    return res.redirect(
      `${frontendUrl}/settings/integrations?linkedin=error&reason=missing_params`,
    );
  }
  const result = await li.exchangeCodeForTokens(code, state);
  const org = result.linkedInOrgName ? `&org=${encodeURIComponent(result.linkedInOrgName)}` : '';
  const name = result.linkedInName ? `&name=${encodeURIComponent(result.linkedInName)}` : '';
  return res.redirect(`${frontendUrl}/settings/integrations?linkedin=connected${org}${name}`);
});

export const getStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = String(req.user?.userId);
  const status = await li.getConnectionStatus(userId);
  sendSuccess(res, StatusCodes.OK, 'LinkedIn connection status', status);
});

export const refreshOrganization = catchAsync(async (req: Request, res: Response) => {
  const userId = String(req.user?.userId);
  const result = await li.refreshOrganizationDiscovery(userId);
  sendSuccess(res, StatusCodes.OK, 'Company pages refreshed', result);
});

export const setOrganization = catchAsync(async (req: Request, res: Response) => {
  const { orgId, orgName } = getRequestBody<{ orgId: string; orgName?: string }>(req);
  const userId = String(req.user?.userId);
  const result = await li.setManualOrganization(userId, orgId, orgName);
  sendSuccess(res, StatusCodes.OK, 'Company page linked', result);
});

export const updatePreference = catchAsync(async (req: Request, res: Response) => {
  const { postAsOrg } = getRequestBody<{ postAsOrg: boolean }>(req);
  const userId = String(req.user?.userId);
  const result = await li.updatePostPreference(userId, postAsOrg);
  sendSuccess(res, StatusCodes.OK, 'LinkedIn posting preference saved', result);
});

export const disconnect = catchAsync(async (req: Request, res: Response) => {
  const userId = String(req.user?.userId);
  const tenantId = String(req.user?.tenantId);
  await li.disconnectLinkedIn(userId, tenantId);
  sendSuccess(res, StatusCodes.OK, 'LinkedIn disconnected', null);
});

export const uploadJobImage = catchAsync(async (req: Request, res: Response) => {
  const jobId = requireStringValue(req.params.jobId, 'jobId');
  const tenantId = String(req.user?.tenantId);
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    throw new AppError('Image file is required', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  const result = await li.uploadJobShareImage(jobId, tenantId, file);
  sendSuccess(res, StatusCodes.OK, 'LinkedIn share image uploaded', result);
});

export const clearJobImage = catchAsync(async (req: Request, res: Response) => {
  const jobId = requireStringValue(req.params.jobId, 'jobId');
  const tenantId = String(req.user?.tenantId);
  const result = await li.clearJobShareImage(jobId, tenantId);
  sendSuccess(res, StatusCodes.OK, 'LinkedIn share image removed', result);
});

export const autoPost = catchAsync(async (req: Request, res: Response) => {
  const { jobId, customText, postAsOrg } = getRequestBody<{
    jobId: string;
    customText?: string;
    postAsOrg?: boolean;
  }>(req);
  const tenantId = String(req.user?.tenantId);
  const userId = String(req.user?.userId);
  const result = await li.autoPost(jobId, tenantId, userId, { customText, postAsOrg });
  sendSuccess(res, StatusCodes.CREATED, 'Posted to LinkedIn', result);
});

export const getJobPosts = catchAsync(async (req: Request, res: Response) => {
  const jobId = requireStringValue(req.params.jobId, 'jobId');
  const tenantId = String(req.user?.tenantId);
  const posts = await li.getJobPostHistory(jobId, tenantId);
  sendSuccess(res, StatusCodes.OK, 'LinkedIn post history', posts);
});

export const getAllPosts = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = parsePagination(req.query.page, req.query.limit);
  const tenantId = String(req.user?.tenantId);
  const result = await li.getAllTenantPosts(tenantId, page, limit);
  sendPaginated(res, StatusCodes.OK, result);
});
