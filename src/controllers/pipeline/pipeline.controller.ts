import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { parsePagination } from '../../common/utils/pagination';
import { requireStringValue } from '../../common/utils/requestValue';
import { pipelineService } from '../../services/pipeline/pipeline.service';
import { CreatePipelineInput, UpdatePipelineInput } from '../../types/pipeline/pipeline.types';

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
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = String(req.user?.tenantId);
  const result = await pipelineService.listPipelinesByTenant(tenantId, pagination);
  sendSuccess(res, StatusCodes.OK, 'Pipeline entries fetched successfully', result.items, {
    total: result.total,
    ...pagination,
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
