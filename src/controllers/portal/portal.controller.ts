import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendPaginated, sendSuccess } from '../../common/utils/apiResponse';
import { parsePagination } from '../../common/utils/pagination';
import { getRequestBody } from '../../common/utils/requestBody';
import { requireStringValue } from '../../common/utils/requestValue';
import { candidateAuthService } from '../../services/portal/candidateAuth.service';
import { portalJobService } from '../../services/portal/portalJob.service';
import { portalApplicationService } from '../../services/portal/portalApplication.service';
import { portalProfileService } from '../../services/portal/portalProfile.service';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';

export const portalRegisterCandidate = catchAsync(async (req: Request, res: Response) => {
  const payload = getRequestBody<{
    tenantSlug: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }>(req);
  const result = await candidateAuthService.register(payload);
  sendSuccess(res, StatusCodes.CREATED, 'Candidate registered', result);
});

export const portalLoginCandidate = catchAsync(async (req: Request, res: Response) => {
  const payload = getRequestBody<{ tenantSlug: string; email: string; password: string }>(req);
  const result = await candidateAuthService.login(payload.tenantSlug, payload.email, payload.password);
  sendSuccess(res, StatusCodes.OK, 'Candidate login successful', result);
});

export const portalRefresh = catchAsync(async (req: Request, res: Response) => {
  const payload = getRequestBody<{ refreshToken: string }>(req);
  const result = await candidateAuthService.refresh(payload.refreshToken);
  sendSuccess(res, StatusCodes.OK, 'Access token refreshed', result);
});

export const portalMe = catchAsync(async (req: Request, res: Response) => {
  const candidateId = String(req.candidate?.candidateId);
  const tenantId = String(req.candidate?.tenantId);
  const result = await candidateAuthService.me(candidateId, tenantId);
  sendSuccess(res, StatusCodes.OK, 'Candidate profile fetched', result);
});

export const portalListJobs = catchAsync(async (req: Request, res: Response) => {
  const tenantSlug = requireStringValue(req.params.tenantSlug, 'tenantSlug');
  const department = (req.query.department as string | undefined) ?? undefined;
  const search = (req.query.search as string | undefined) ?? undefined;
  const pagination = parsePagination(req.query.page, req.query.limit);
  const result = await portalJobService.listOpenJobs(tenantSlug, {
    department,
    search,
    page: pagination.page,
    limit: pagination.limit,
  });
  sendPaginated(res, StatusCodes.OK, {
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});

export const portalGetJob = catchAsync(async (req: Request, res: Response) => {
  const tenantSlug = requireStringValue(req.params.tenantSlug, 'tenantSlug');
  const jobId = requireStringValue(req.params.jobId, 'jobId');
  const result = await portalJobService.getOpenJobById(tenantSlug, jobId);
  sendSuccess(res, StatusCodes.OK, 'Job fetched', result);
});

export const portalApplyToJob = catchAsync(async (req: Request, res: Response) => {
  const candidateId = String(req.candidate?.candidateId);
  const tenantId = String(req.candidate?.tenantId);
  const jobId = requireStringValue(req.params.jobId, 'jobId');
  const tenantSlug = requireStringValue(req.params.tenantSlug, 'tenantSlug');

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) {
    throw new AppError('Company not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }
  if (tenant.id !== tenantId) {
    throw new AppError('Company not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }

  const payload = getRequestBody<{ resumeUrl?: string; resumeMimeType?: string; coverLetter?: string }>(req);
  const result = await portalApplicationService.applyToJob(candidateId, tenantId, jobId, payload);
  sendSuccess(res, StatusCodes.CREATED, 'Application submitted', result);
});

export const portalMyApplications = catchAsync(async (req: Request, res: Response) => {
  const candidateId = String(req.candidate?.candidateId);
  const tenantId = String(req.candidate?.tenantId);
  const pagination = parsePagination(req.query.page, req.query.limit);
  const result = await portalApplicationService.getMyApplications(candidateId, tenantId, {
    page: pagination.page,
    limit: pagination.limit,
  });
  sendPaginated(res, StatusCodes.OK, {
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});

export const portalMyApplicationById = catchAsync(async (req: Request, res: Response) => {
  const candidateId = String(req.candidate?.candidateId);
  const tenantId = String(req.candidate?.tenantId);
  const pipelineId = requireStringValue(req.params.pipelineId, 'pipelineId');
  const result = await portalApplicationService.getMyApplicationById(candidateId, tenantId, pipelineId);
  sendSuccess(res, StatusCodes.OK, 'Application fetched', result);
});

export const portalUpdateProfile = catchAsync(async (req: Request, res: Response) => {
  const candidateId = String(req.candidate?.candidateId);
  const tenantId = String(req.candidate?.tenantId);
  const payload = getRequestBody<{
    firstName?: string;
    lastName?: string;
    phone?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    expectedSalary?: number;
    noticePeriod?: number;
    skills?: string[];
    location?: string;
  }>(req);
  const result = await portalProfileService.updateProfile(candidateId, tenantId, payload);
  sendSuccess(res, StatusCodes.OK, 'Profile updated', result);
});

