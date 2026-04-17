import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { parsePagination } from '../../common/utils/pagination';
import { requireStringValue } from '../../common/utils/requestValue';
import { evaluationService } from '../../services/evaluation/evaluation.service';
import {
  CreateEvaluationInput,
  EvaluationInsightPreviewInput,
  UpdateEvaluationInput,
} from '../../types/evaluation/evaluation.types';

export const createEvaluation = catchAsync(async (req: Request, res: Response) => {
  const evaluationInput = getRequestBody<CreateEvaluationInput>(req);
  const result = await evaluationService.createEvaluation(evaluationInput);
  sendSuccess(res, StatusCodes.CREATED, 'Evaluation created successfully', result);
});

export const getEvaluation = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const evaluationId = requireStringValue(params.id, 'evaluationId');
  const result = await evaluationService.getEvaluationById(evaluationId);
  sendSuccess(res, StatusCodes.OK, 'Evaluation fetched successfully', result);
});

export const listEvaluations = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = requireStringValue(query.tenantId, 'tenantId');
  const result = await evaluationService.listEvaluationsByTenant(tenantId, pagination);
  sendSuccess(res, StatusCodes.OK, 'Evaluations fetched successfully', result.items, {
    total: result.total,
    ...pagination,
  });
});

export const previewEvaluationInsight = catchAsync(async (req: Request, res: Response) => {
  const insightInput = getRequestBody<EvaluationInsightPreviewInput>(req);
  const result = evaluationService.previewEvaluationInsight(insightInput);
  sendSuccess(res, StatusCodes.OK, 'Evaluation insight preview generated successfully', result);
});

export const updateEvaluation = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const evaluationId = requireStringValue(params.id, 'evaluationId');
  const evaluationInput = getRequestBody<UpdateEvaluationInput>(req);
  const result = await evaluationService.updateEvaluation(evaluationId, evaluationInput);
  sendSuccess(res, StatusCodes.OK, 'Evaluation updated successfully', result);
});
