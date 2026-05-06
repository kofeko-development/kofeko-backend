import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendPaginated, sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { parsePagination } from '../../common/utils/pagination';
import { requireStringValue } from '../../common/utils/requestValue';
import { evaluationService } from '../../services/evaluation/evaluation.service';
import {
  CreateEvaluationInput,
  UpdateEvaluationInput,
} from '../../types/evaluation/evaluation.types';

export const createEvaluation = catchAsync(async (req: Request, res: Response) => {
  const evaluationInput = getRequestBody<CreateEvaluationInput>(req);
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await evaluationService.createEvaluation({ ...evaluationInput, tenantId }, actorId);
  sendSuccess(res, StatusCodes.CREATED, 'Evaluation created successfully', result);
});

export const getEvaluation = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const evaluationId = requireStringValue(params.id, 'evaluationId');
  const tenantId = String(req.user?.tenantId);
  const result = await evaluationService.getEvaluationById(evaluationId, tenantId);
  sendSuccess(res, StatusCodes.OK, 'Evaluation fetched successfully', result);
});

export const listEvaluations = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = String(req.user?.tenantId);
  const result = await evaluationService.listEvaluationsByTenant(tenantId, pagination);
  sendPaginated(res, StatusCodes.OK, {
    items: result.items,
    total: result.total,
    page: pagination.page,
    limit: pagination.limit,
  });
});

export const updateEvaluation = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const evaluationId = requireStringValue(params.id, 'evaluationId');
  const evaluationInput = getRequestBody<UpdateEvaluationInput>(req);
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await evaluationService.updateEvaluation(evaluationId, tenantId, evaluationInput, actorId);
  sendSuccess(res, StatusCodes.OK, 'Evaluation updated successfully', result);
});

export const aiEvaluate = catchAsync(async (req: Request, res: Response) => {
  const input = getRequestBody<{ jobId: string; candidateId: string; pipelineId?: string }>(req);
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await evaluationService.aiEvaluate(input, tenantId, actorId);
  sendSuccess(res, StatusCodes.CREATED, 'AI evaluation created successfully', result);
});
