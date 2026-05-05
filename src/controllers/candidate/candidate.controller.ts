import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { parsePagination } from '../../common/utils/pagination';
import { requireStringValue } from '../../common/utils/requestValue';
import { candidateService } from '../../services/candidate/candidate.service';
import { CreateCandidateInput, UpdateCandidateInput } from '../../types/candidate/candidate.types';

export const createCandidate = catchAsync(async (req: Request, res: Response) => {
  const candidateInput = getRequestBody<CreateCandidateInput>(req);
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await candidateService.createCandidate({ ...candidateInput, tenantId }, actorId);
  sendSuccess(res, StatusCodes.CREATED, 'Candidate created successfully', result);
});

export const getCandidate = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const candidateId = requireStringValue(params.id, 'candidateId');
  const tenantId = String(req.user?.tenantId);
  const result = await candidateService.getCandidateById(candidateId, tenantId);
  sendSuccess(res, StatusCodes.OK, 'Candidate fetched successfully', result);
});

export const listCandidates = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = String(req.user?.tenantId);
  const result = await candidateService.listCandidatesByTenant(tenantId, pagination);
  sendSuccess(res, StatusCodes.OK, 'Candidates fetched successfully', result.items, {
    total: result.total,
    ...pagination,
  });
});

export const updateCandidate = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const candidateId = requireStringValue(params.id, 'candidateId');
  const candidateInput = getRequestBody<UpdateCandidateInput>(req);
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const result = await candidateService.updateCandidate(candidateId, tenantId, candidateInput, actorId);
  sendSuccess(res, StatusCodes.OK, 'Candidate updated successfully', result);
});
