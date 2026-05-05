import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess } from '../../common/utils/apiResponse';
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
  sendSuccess(res, StatusCodes.OK, 'Metrics fetched successfully', result.items, {
    total: result.total,
    ...pagination,
  });
});

export const getDashboardSummary = catchAsync(async (req: Request, res: Response) => {
  const tenantId = String(req.user?.tenantId);
  const result = await analyticsService.getDashboardSummary(tenantId);
  sendSuccess(res, StatusCodes.OK, 'Analytics summary fetched successfully', result);
});

export const getSlaSummary = catchAsync(async (req: Request, res: Response) => {
  const tenantId = String(req.user?.tenantId);
  const result = await analyticsService.getSlaSummary(tenantId);
  sendSuccess(res, StatusCodes.OK, 'Analytics SLA summary fetched successfully', result);
});
