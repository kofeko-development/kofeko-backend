import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendPaginated, sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { parsePagination } from '../../common/utils/pagination';
import { requireStringValue } from '../../common/utils/requestValue';
import { jobService } from '../../services/job/job.service';
import { evaluationService } from '../../services/evaluation/evaluation.service';
import { CreateJobInput, UpdateJobInput } from '../../types/job/job.types';

export const createJob = catchAsync(async (req: Request, res: Response) => {
  const jobInput = getRequestBody<CreateJobInput>(req);
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await jobService.createJob({ ...jobInput, tenantId }, actorId);
  sendSuccess(res, StatusCodes.CREATED, 'Job created successfully', result);
});

export const getJob = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const jobId = requireStringValue(params.id, 'jobId');
  const tenantId = String(req.user?.tenantId);
  const result = await jobService.getJobById(jobId, tenantId);
  sendSuccess(res, StatusCodes.OK, 'Job fetched successfully', result);
});

export const listJobs = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { page, limit, status, department } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = String(req.user?.tenantId);
  const result = await jobService.listJobsByTenant(tenantId, {
    ...pagination,
    status: status ? (String(status) as 'draft' | 'open' | 'paused' | 'closed') : undefined,
    department: department ? String(department) : undefined,
  });
  sendPaginated(res, StatusCodes.OK, {
    items: result.items,
    total: result.total,
    page: pagination.page,
    limit: pagination.limit,
  });
});

export const updateJob = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const jobId = requireStringValue(params.id, 'jobId');
  const jobInput = getRequestBody<UpdateJobInput>(req);
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await jobService.updateJob(jobId, tenantId, jobInput, actorId);
  sendSuccess(res, StatusCodes.OK, 'Job updated successfully', result);
});

export const publishJob = catchAsync(async (req: Request, res: Response) => {
  const jobId = requireStringValue(req.params.id, 'jobId');
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await jobService.publishJob(jobId, tenantId, actorId);
  sendSuccess(res, StatusCodes.OK, 'Job published successfully', result);
});

export const pauseJob = catchAsync(async (req: Request, res: Response) => {
  const jobId = requireStringValue(req.params.id, 'jobId');
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await jobService.pauseJob(jobId, tenantId, actorId);
  sendSuccess(res, StatusCodes.OK, 'Job paused successfully', result);
});

export const closeJob = catchAsync(async (req: Request, res: Response) => {
  const jobId = requireStringValue(req.params.id, 'jobId');
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await jobService.closeJob(jobId, tenantId, actorId);
  sendSuccess(res, StatusCodes.OK, 'Job closed successfully', result);
});

export const evaluateAllForJob = catchAsync(async (req: Request, res: Response) => {
  const jobId = requireStringValue(req.params.jobId, 'jobId');
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await evaluationService.batchAiEvaluate(jobId, tenantId, actorId);
  sendSuccess(res, StatusCodes.OK, 'Batch AI evaluation completed', result);
});

export const getJobRankings = catchAsync(async (req: Request, res: Response) => {
  const jobId = requireStringValue(req.params.jobId, 'jobId');
  const tenantId = String(req.user?.tenantId);
  const result = await evaluationService.getRankings(jobId, tenantId);
  sendSuccess(res, StatusCodes.OK, 'Rankings fetched successfully', result);
});
