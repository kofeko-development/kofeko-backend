import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendPaginated, sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { parsePagination } from '../../common/utils/pagination';
import { analyticsService } from '../../services/analytics/analytics.service';
import { CreateMetricInput } from '../../types/analytics/analytics.types';

export const createMetric = catchAsync(async (req: Request, res: Response) => {
  const metricInput = getRequestBody<CreateMetricInput>(req);
  const tenantId = String(req.user?.tenantId);
  const result = await analyticsService.createMetric({ ...metricInput, tenantId });
  sendSuccess(res, StatusCodes.CREATED, 'Metric recorded successfully', result);
});

export const listMetrics = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = String(req.user?.tenantId);
  const result = await analyticsService.listMetricsByTenant(tenantId, pagination);
  sendPaginated(res, StatusCodes.OK, {
    items: result.items,
    total: result.total,
    page: pagination.page,
    limit: pagination.limit,
  });
});

export const getDashboardSummary = catchAsync(async (req: Request, res: Response) => {
  const tenantId = String(req.user?.tenantId);
  const result = await analyticsService.getSummary(tenantId);
  sendSuccess(res, StatusCodes.OK, 'Analytics summary fetched successfully', result);
});

export const getSlaSummary = catchAsync(async (req: Request, res: Response) => {
  const tenantId = String(req.user?.tenantId);
  const result = await analyticsService.getSlaSummary(tenantId);
  sendSuccess(res, StatusCodes.OK, 'Analytics SLA summary fetched successfully', result);
});

export const getPipelineFunnel = catchAsync(async (req: Request, res: Response) => {
  const tenantId = String(req.user?.tenantId);
  const jobId = req.query.jobId ? String(req.query.jobId) : undefined;
  const result = await analyticsService.getPipelineFunnel(tenantId, jobId);
  sendSuccess(res, StatusCodes.OK, 'Pipeline funnel fetched successfully', result);
});

export const getTimeToDecision = catchAsync(async (req: Request, res: Response) => {
  const tenantId = String(req.user?.tenantId);
  const jobId = req.query.jobId ? String(req.query.jobId) : undefined;
  const result = await analyticsService.getTimeToDecision(tenantId, jobId);
  sendSuccess(res, StatusCodes.OK, 'Time to decision fetched successfully', result);
});

export const getScoreDistribution = catchAsync(async (req: Request, res: Response) => {
  const tenantId = String(req.user?.tenantId);
  const jobId = req.query.jobId ? String(req.query.jobId) : undefined;
  const result = await analyticsService.getScoreDistribution(tenantId, jobId);
  sendSuccess(res, StatusCodes.OK, 'Score distribution fetched successfully', result);
});

export const getRecentActivity = catchAsync(async (req: Request, res: Response) => {
  const tenantId = String(req.user?.tenantId);
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const result = await analyticsService.getRecentActivity(tenantId, limit);
  sendSuccess(res, StatusCodes.OK, 'Recent activity fetched successfully', result);
});

export const getHiringVelocity = catchAsync(async (req: Request, res: Response) => {
  const tenantId = String(req.user?.tenantId);
  const jobId = req.query.jobId ? String(req.query.jobId) : undefined;
  const result = await analyticsService.getHiringVelocity(tenantId, jobId);
  sendSuccess(res, StatusCodes.OK, 'Hiring velocity fetched successfully', result);
});
