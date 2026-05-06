import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendPaginated, sendSuccess } from '../../common/utils/apiResponse';
import { getRequestBody } from '../../common/utils/requestBody';
import { parsePagination } from '../../common/utils/pagination';
import { requireStringValue } from '../../common/utils/requestValue';
import { candidateService } from '../../services/candidate/candidate.service';
import { CreateCandidateInput, UpdateCandidateInput } from '../../types/candidate/candidate.types';
import { uploadFile } from '../../common/storage/fileUpload';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';

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
  const { page, limit, status, skills } = query;
  const pagination = parsePagination(page, limit);
  const tenantId = String(req.user?.tenantId);
  const skillsList =
    typeof skills === 'string' && skills.trim()
      ? skills.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
  const result = await candidateService.listCandidates(tenantId, {
    pagination,
    status: status ? String(status) : undefined,
    skills: skillsList,
  });
  sendPaginated(res, StatusCodes.OK, {
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
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

export const updateCandidateStatus = catchAsync(async (req: Request, res: Response) => {
  const candidateId = requireStringValue(req.params.id, 'candidateId');
  const tenantId = String(req.user?.tenantId);
  const actorId = String(req.user?.userId);
  const { status } = req.body as { status: string };
  const result = await candidateService.updateCandidateStatus(candidateId, tenantId, status, actorId);
  sendSuccess(res, StatusCodes.OK, 'Candidate status updated successfully', result);
});

export const uploadResume = catchAsync(async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    throw new AppError('Resume file is required', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }

  const allowed = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ]);

  if (!allowed.has(file.mimetype)) {
    throw new AppError('Unsupported format. Use PDF, DOCX, or TXT.', StatusCodes.UNSUPPORTED_MEDIA_TYPE, ERROR_CODES.VALIDATION_ERROR);
  }

  const maxBytes = 8 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new AppError('File is too large (max 8 MB).', StatusCodes.REQUEST_TOO_LONG, ERROR_CODES.VALIDATION_ERROR);
  }

  const url = await uploadFile(file.buffer, file.originalname, file.mimetype);
  sendSuccess(res, StatusCodes.OK, 'Resume uploaded successfully', {
    url,
    mimeType: file.mimetype,
    filename: file.originalname,
  });
});
