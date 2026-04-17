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
  const result = await candidateService.createCandidate(candidateInput);
  sendSuccess(res, StatusCodes.CREATED, 'Candidate created successfully', result);
});

export const getCandidate = catchAsync(async (req: Request, res: Response) => {
  const { params } = req;
  const candidateId = requireStringValue(params.id, 'candidateId');
  const result = await candidateService.getCandidateById(candidateId);
  sendSuccess(res, StatusCodes.OK, 'Candidate fetched successfully', result);
});

export const listCandidates = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = requireStringValue(query.tenantId, 'tenantId');
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
  const result = await candidateService.updateCandidate(candidateId, candidateInput);
  sendSuccess(res, StatusCodes.OK, 'Candidate updated successfully', result);
});
