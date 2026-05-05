import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { parsePagination } from '../../common/utils/pagination';
import { requireStringValue } from '../../common/utils/requestValue';
import { jobService } from '../../services/job/job.service';
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
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = String(req.user?.tenantId);
  const result = await jobService.listJobsByTenant(tenantId, pagination);
  sendSuccess(res, StatusCodes.OK, 'Jobs fetched successfully', result.items, {
    total: result.total,
    ...pagination,
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
