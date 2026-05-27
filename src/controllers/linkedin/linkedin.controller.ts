import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess, sendPaginated } from '../../common/utils/apiResponse';
import { parsePagination } from '../../common/utils/pagination';
import { getRequestBody } from '../../common/utils/requestBody';
import { requireStringValue } from '../../common/utils/requestValue';
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
    return res.redirect(
      `${frontendUrl}/settings/integrations?linkedin=error&reason=${encodeURIComponent(errorDescription ?? error)}`,
    );
  }
  if (!code || !state) {
    return res.redirect(
      `${frontendUrl}/settings/integrations?linkedin=error&reason=missing_params`,
    );
  }
  await li.exchangeCodeForTokens(code, state);
  return res.redirect(`${frontendUrl}/settings/integrations?linkedin=connected`);
});

export const getStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = String(req.user?.userId);
  const status = await li.getConnectionStatus(userId);
  sendSuccess(res, StatusCodes.OK, 'LinkedIn connection status', status);
});

export const disconnect = catchAsync(async (req: Request, res: Response) => {
  const userId = String(req.user?.userId);
  const tenantId = String(req.user?.tenantId);
  await li.disconnectLinkedIn(userId, tenantId);
  sendSuccess(res, StatusCodes.OK, 'LinkedIn disconnected', null);
});

export const autoPost = catchAsync(async (req: Request, res: Response) => {
  const { jobId, customText } = getRequestBody<{ jobId: string; customText?: string }>(req);
  const tenantId = String(req.user?.tenantId);
  const userId = String(req.user?.userId);
  const result = await li.autoPost(jobId, tenantId, userId, customText);
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
