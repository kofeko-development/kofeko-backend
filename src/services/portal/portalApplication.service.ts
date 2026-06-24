import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { communicationService } from '../communication/communication.service';
import { cacheKeys, cacheService } from '../../common/cache/cacheService';
import { CACHE_LIST_TTL } from '../../common/cache/cacheTtl';

function applicationsQueryKey(pagination: { page: number; limit: number }): string {
  return `${pagination.page}:${pagination.limit}`;
}

export const portalApplicationService = {
  async applyToJob(
    candidateId: string,
    tenantId: string,
    jobId: string,
    payload: { resumeUrl?: string; resumeMimeType?: string; coverLetter?: string },
  ) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, tenantId },
      select: { id: true, title: true, status: true },
    });

    if (!job) {
      throw new AppError('Job not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    if (job.status !== 'open') {
      throw new AppError('Job is not open for applications', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const existing = await prisma.pipeline.findFirst({
      where: { tenantId, jobId, candidateId },
      select: { id: true },
    });
    if (existing) {
      throw new AppError('You have already applied to this job', StatusCodes.CONFLICT, ERROR_CODES.CONFLICT);
    }

    if (!payload.resumeUrl?.trim()) {
      throw new AppError('Resume is required to apply for this job', StatusCodes.BAD_REQUEST, ERROR_CODES.NO_RESUME);
    }

    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        resumeUrl: payload.resumeUrl,
        resumeMimeType: payload.resumeMimeType,
      },
    });

    const pipeline = await prisma.pipeline.create({
      data: {
        tenantId,
        jobId,
        candidateId,
        stage: 'applied',
        notes: payload.coverLetter ? `Cover letter:\n${payload.coverLetter}` : undefined,
      },
      select: { id: true, createdAt: true, stage: true },
    });

    try {
      const candidate = await prisma.candidate.findFirst({
        where: { id: candidateId, tenantId },
        select: { email: true, firstName: true, lastName: true },
      });
      if (candidate) {
        await communicationService.sendManualMessage(tenantId, {
          to: candidate.email,
          subject: `Application received: ${job.title}`,
          html: `<p>Hi ${candidate.firstName} ${candidate.lastName},</p><p>We received your application for <b>${job.title}</b>.</p>`,
        });
      }
    } catch {
      // fire-and-forget
    }

    await cacheService.invalidateMyApplications(candidateId);
    await cacheService.invalidateTenantPipelines(tenantId, jobId);
    await cacheService.invalidateJob(tenantId, jobId);

    return {
      pipelineId: pipeline.id,
      jobTitle: job.title,
      stage: pipeline.stage,
      appliedAt: pipeline.createdAt,
    };
  },

  async getMyApplications(candidateId: string, _tenantId: string, pagination: { page: number; limit: number }) {
    const queryKey = applicationsQueryKey(pagination);
    const cacheKey = cacheKeys.myApplications(candidateId, queryKey);
    return cacheService.getOrSet(cacheKey, CACHE_LIST_TTL, async () => {
    const currentCandidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { email: true }
    });

    if (!currentCandidate) {
      return {
        items: [],
        total: 0,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: 1,
      };
    }

    const skip = (pagination.page - 1) * pagination.limit;
    const where = {
      candidate: {
        email: currentCandidate.email
      }
    };

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
              customStages: true,
              tenant: {
                select: {
                  name: true
                }
              }
            },
          },
        },
      }),
    ]);

    const mapped = items.map((row) => ({
      pipelineId: row.id,
      job: {
        id: row.job.id,
        title: row.job.title,
        department: row.job.department,
        companyName: row.job.tenant.name,
        customStages: row.job.customStages
      },
      stage: row.stage,
      appliedAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return {
      items: mapped,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    };
    });
  },

  async getMyApplicationById(candidateId: string, _tenantId: string, pipelineId: string) {
    const cacheKey = cacheKeys.myApplicationDetail(candidateId, pipelineId);
    return cacheService.getOrSet(cacheKey, CACHE_LIST_TTL, async () => {
    const currentCandidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { email: true }
    });

    if (!currentCandidate) {
      throw new AppError('Candidate not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        candidate: {
          email: currentCandidate.email
        }
      },
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
            customStages: true,
            tenant: {
              select: {
                name: true
              }
            }
          },
        },
      },
    });

    if (!pipeline) {
      throw new AppError('Application not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return {
      pipelineId: pipeline.id,
      job: {
        id: pipeline.job.id,
        title: pipeline.job.title,
        department: pipeline.job.department,
        companyName: pipeline.job.tenant.name,
        customStages: pipeline.job.customStages
      },
      stage: pipeline.stage,
      appliedAt: pipeline.createdAt,
      updatedAt: pipeline.updatedAt,
    };
    });
  },
};

