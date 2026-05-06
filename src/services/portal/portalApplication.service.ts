import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { communicationService } from '../communication/communication.service';

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

    if (payload.resumeUrl) {
      await prisma.candidate.update({
        where: { id: candidateId },
        data: {
          resumeUrl: payload.resumeUrl,
          resumeMimeType: payload.resumeMimeType,
        },
      });
    }

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

    return {
      pipelineId: pipeline.id,
      jobTitle: job.title,
      stage: pipeline.stage,
      appliedAt: pipeline.createdAt,
    };
  },

  async getMyApplications(candidateId: string, tenantId: string, pagination: { page: number; limit: number }) {
    const skip = (pagination.page - 1) * pagination.limit;
    const where = { tenantId, candidateId };

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
            },
          },
        },
      }),
    ]);

    const mapped = items.map((row) => ({
        pipelineId: row.id,
        job: row.job,
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
  },

  async getMyApplicationById(candidateId: string, tenantId: string, pipelineId: string) {
    const pipeline = await prisma.pipeline.findFirst({
      where: { id: pipelineId, tenantId, candidateId },
      select: {
        id: true,
        stage: true,
        createdAt: true,
        updatedAt: true,
        job: {
          select: { id: true, title: true, department: true },
        },
      },
    });

    if (!pipeline) {
      throw new AppError('Application not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return {
      pipelineId: pipeline.id,
      job: pipeline.job,
      stage: pipeline.stage,
      appliedAt: pipeline.createdAt,
      updatedAt: pipeline.updatedAt,
    };
  },
};

