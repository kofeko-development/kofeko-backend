import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendPaginated, sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { parsePagination } from '../../common/utils/pagination';
import { requireStringValue } from '../../common/utils/requestValue';
import { pipelineService } from '../../services/pipeline/pipeline.service';
import { CreatePipelineInput, UpdatePipelineInput } from '../../types/pipeline/pipeline.types';
import { PipelineStage } from '@prisma/client';

export const createPipeline = catchAsync(async (req: Request, res: Response) => {
  const pipelineInput = getRequestBody<CreatePipelineInput>(req);
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await pipelineService.createPipeline({ ...pipelineInput, tenantId }, actorId);
  sendSuccess(res, StatusCodes.CREATED, 'Pipeline entry created successfully', result);
});

export const getPipeline = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const pipelineId = requireStringValue(params.id, 'pipelineId');
  const tenantId = String(req.user?.tenantId);
  const result = await pipelineService.getPipelineById(pipelineId, tenantId);
  sendSuccess(res, StatusCodes.OK, 'Pipeline entry fetched successfully', result);
});

export const listPipelines = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { page, limit, jobId, candidateId, stage } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = String(req.user?.tenantId);
  const result = await pipelineService.listPipelines(tenantId, {
    filters: {
      jobId: jobId ? String(jobId) : undefined,
      candidateId: candidateId ? String(candidateId) : undefined,
      stage: stage ? (String(stage) as PipelineStage) : undefined,
    },
    pagination,
  });
  sendPaginated(res, StatusCodes.OK, {
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});

export const updatePipeline = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const pipelineId = requireStringValue(params.id, 'pipelineId');
  const pipelineInput = getRequestBody<UpdatePipelineInput>(req);
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await pipelineService.updatePipeline(pipelineId, tenantId, pipelineInput, actorId);
  sendSuccess(res, StatusCodes.OK, 'Pipeline entry updated successfully', result);
});

export const advanceStage = catchAsync(async (req: Request, res: Response) => {
  const pipelineId = requireStringValue(req.params.id, 'pipelineId');
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const { stage, note } = req.body as { stage: PipelineStage; note?: string };
  const result = await pipelineService.advanceStage(pipelineId, tenantId, stage, note, actorId);
  sendSuccess(res, StatusCodes.OK, 'Pipeline stage advanced successfully', result);
});

export const assignInterviewer = catchAsync(async (req: Request, res: Response) => {
  const pipelineId = requireStringValue(req.params.id, 'pipelineId');
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const { userId } = req.body as { userId: string };
  const result = await pipelineService.assignInterviewer(pipelineId, tenantId, userId, actorId);
  sendSuccess(res, StatusCodes.OK, 'Interviewer assigned successfully', result);
});

export const setPipelineSla = catchAsync(async (req: Request, res: Response) => {
  const pipelineId = requireStringValue(req.params.id, 'pipelineId');
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const { deadline } = req.body as { deadline: string | Date };
  const result = await pipelineService.setPipelineSLA(pipelineId, tenantId, new Date(deadline), actorId);
  sendSuccess(res, StatusCodes.OK, 'SLA deadline set successfully', result);
});
