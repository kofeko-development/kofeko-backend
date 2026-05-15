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
import { uploadFile } from '../../common/storage/fileUpload';
import { extractResumeText } from '../../common/ai/extractResumeText';
import { parseResumeOnly } from '../../common/ai/parseResume';

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

export const portalListAllJobs = catchAsync(async (req: Request, res: Response) => {
  const search = (req.query.search as string | undefined) ?? undefined;
  const pagination = parsePagination(req.query.page, req.query.limit);
  const result = await portalJobService.listAllOpenJobs({
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

export const portalGetAnyJob = catchAsync(async (req: Request, res: Response) => {
  const jobId = requireStringValue(req.params.jobId, 'jobId');
  const result = await portalJobService.getAnyOpenJobById(jobId);
  sendSuccess(res, StatusCodes.OK, 'Job fetched', result);
});

export const portalApplyToJob = catchAsync(async (req: Request, res: Response) => {
  const loggedInCandidateId = String(req.candidate?.candidateId);
  const jobId = requireStringValue(req.params.jobId, 'jobId');
  const tenantSlug = requireStringValue(req.params.tenantSlug, 'tenantSlug');

  // 1. Resolve the TARGET tenant
  const targetTenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!targetTenant) {
    throw new AppError('Company not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }

  // 2. Get the logged-in candidate's profile
  const sourceCandidate = await prisma.candidate.findUnique({
    where: { id: loggedInCandidateId },
  });
  if (!sourceCandidate) {
    throw new AppError('Candidate profile not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }

  // 3. Ensure candidate exists in TARGET tenant (sync if needed)
  const candidateData = {
    firstName: sourceCandidate.firstName,
    lastName: sourceCandidate.lastName,
    passwordHash: sourceCandidate.passwordHash,
    phoneNumber: sourceCandidate.phoneNumber,
    resumeUrl: sourceCandidate.resumeUrl,
    resumeMimeType: sourceCandidate.resumeMimeType,
    linkedinUrl: sourceCandidate.linkedinUrl,
    portfolioUrl: sourceCandidate.portfolioUrl,
    location: sourceCandidate.location,
    summary: sourceCandidate.summary,
    skills: sourceCandidate.skills,
    education: sourceCandidate.education || undefined,
    workExperience: sourceCandidate.workExperience || undefined,
    projects: sourceCandidate.projects || undefined,
    hobbies: sourceCandidate.hobbies || undefined,
    yearsOfExperience: sourceCandidate.yearsOfExperience,
    source: sourceCandidate.source,
    currentCompany: sourceCandidate.currentCompany,
  };

  const targetCandidate = await prisma.candidate.upsert({
    where: {
      tenantId_email: {
        tenantId: targetTenant.id,
        email: sourceCandidate.email,
      },
    },
    update: candidateData,
    create: {
      ...candidateData,
      tenantId: targetTenant.id,
      email: sourceCandidate.email,
      status: 'new',
    },
  });

  const payload = getRequestBody<{ resumeUrl?: string; resumeMimeType?: string; coverLetter?: string }>(req);

  // 4. Submit application using target candidate and target tenant
  const result = await portalApplicationService.applyToJob(targetCandidate.id, targetTenant.id, jobId, payload);
  sendSuccess(res, StatusCodes.CREATED, 'Application submitted', result);
});

export const portalMyApplications = catchAsync(async (req: Request, res: Response) => {
  const loggedInCandidateId = String(req.candidate?.candidateId);
  const pagination = parsePagination(req.query.page, req.query.limit);

  // 1. Get the current candidate's email
  const currentCandidate = await prisma.candidate.findUnique({
    where: { id: loggedInCandidateId },
    select: { email: true },
  });

  if (!currentCandidate) {
    throw new AppError('Candidate not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }

  // 2. Find ALL candidate IDs associated with this email across ALL tenants
  const allCandidateRecords = await prisma.candidate.findMany({
    where: { email: currentCandidate.email },
    select: { id: true },
  });
  const allIds = allCandidateRecords.map(c => c.id);

  // 3. Fetch applications for ALL those IDs
  const skip = (pagination.page - 1) * pagination.limit;
  const where = { candidateId: { in: allIds } };

  const [total, items] = await Promise.all([
    prisma.pipeline.count({ where }),
    prisma.pipeline.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pagination.limit,
      select: {
        id: true,
        stage: true,
        createdAt: true,
        updatedAt: true,
        job: {
          select: {
            id: true,
            title: true,
            department: true,
            tenant: {
              select: { name: true }
            }
          },
        },
      },
    }),
  ]);

  const mapped = items.map((row) => ({
    pipelineId: row.id,
    job: {
      ...row.job,
      company: row.job.tenant.name // Add company name for UI
    },
    stage: row.stage,
    appliedAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  sendPaginated(res, StatusCodes.OK, {
    items: mapped,
    total,
    page: pagination.page,
    limit: pagination.limit,
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
    summary?: string;
    education?: any[];
    workExperience?: any[];
    projects?: any[];
    hobbies?: string[];
  }>(req);
  const result = await portalProfileService.updateProfile(candidateId, tenantId, payload);
  sendSuccess(res, StatusCodes.OK, 'Profile updated', result);
});

export const portalParseResume = catchAsync(async (req: Request, res: Response) => {
  const candidateId = String(req.candidate?.candidateId);
  const tenantId = String(req.candidate?.tenantId);
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

  const resumeUrl = await uploadFile(file.buffer, file.originalname, file.mimetype);
  const resumeText = await extractResumeText(file.buffer, file.mimetype, file.originalname);
  const parsed = await parseResumeOnly(resumeText);

  await prisma.candidate.updateMany({
    where: { id: candidateId, tenantId },
    data: {
      resumeUrl,
      resumeMimeType: file.mimetype,
      summary: parsed.summary || undefined,
      education: parsed.education.length > 0 ? parsed.education : undefined,
      workExperience: parsed.experience.length > 0 ? parsed.experience : undefined,
      projects: parsed.projects.length > 0 ? parsed.projects : undefined,
      hobbies: parsed.hobbies.length > 0 ? parsed.hobbies : undefined,
      skills: parsed.skills.length > 0 ? parsed.skills : undefined,
    },
  });

  sendSuccess(res, StatusCodes.OK, 'Resume parsed successfully', {
    resumeUrl,
    resumeMimeType: file.mimetype,
    parsed,
  });
});


