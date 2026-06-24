import { CandidateStatus, Pipeline } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { auditService } from '../audit/audit.service';
import { candidateRepository } from '../../repositories/candidate/candidate.repository';
import { jobRepository } from '../../repositories/job/job.repository';
import { pipelineRepository } from '../../repositories/pipeline/pipeline.repository';
import { PaginationInput } from '../../common/utils/pagination';
import { CreatePipelineInput, PipelineListFilters, UpdatePipelineInput } from '../../types/pipeline/pipeline.types';
import { assertValidStageTransition } from '../../common/constants/pipelineStages';
import { prisma } from '../../config/prisma';
import { ROLE_NAMES } from '../../common/constants/roles';
import { communicationService } from '../communication/communication.service';
import { cacheService, cacheKeys } from '../../common/cache/cacheService';
import { CACHE_LIST_TTL } from '../../common/cache/cacheTtl';

function pipelinesQueryKey(
  filters: PipelineListFilters,
  pagination: PaginationInput,
): string {
  return `${filters.jobId ?? ''}:${filters.candidateId ?? ''}:${filters.stage ?? ''}:${pagination.page}:${pagination.limit}`;
}

const resolveCandidateStatusFromStage = (stage: string): CandidateStatus => {
  switch (stage) {
    case 'applied':
      return 'new';
    case 'screening':
      return 'screening';
    case 'technical_interview':
    case 'hr_interview':
      return 'interview';
    case 'offer':
      return 'offer';
    case 'hired':
      return 'hired';
    case 'rejected':
      return 'rejected';
    default:
      return 'interview';
  }
};

export const pipelineService = {
  async createPipeline(payload: CreatePipelineInput, actorId?: string): Promise<Pipeline> {
    const job = await jobRepository.findByIdAndTenant(payload.jobId, payload.tenantId);
    if (!job) {
      throw new AppError('Job not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    if (job.status === 'draft') {
      throw new AppError(
        'This job has not been published yet. Publish the job before adding candidates.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.JOB_NOT_OPEN,
      );
    }
    if (job.status === 'paused') {
      throw new AppError(
        'This job is currently paused. Resume the job to add new candidates.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.JOB_NOT_OPEN,
      );
    }
    if (job.status === 'closed') {
      throw new AppError(
        'This job has been closed and is no longer accepting candidates.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.JOB_IS_CLOSED,
      );
    }

    const candidate = await candidateRepository.findByIdAndTenant(payload.candidateId, payload.tenantId);
    if (!candidate) {
      throw new AppError('Candidate not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    if (!candidate.resumeUrl?.trim()) {
      throw new AppError(
        'Candidate must have a resume before they can be added to a job pipeline.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.NO_RESUME,
      );
    }

    const duplicate = await pipelineRepository.findDuplicate(payload.tenantId, payload.jobId, payload.candidateId);
    if (duplicate) {
      throw new AppError(
        "Candidate is already in this job's pipeline",
        StatusCodes.CONFLICT,
        ERROR_CODES.CONFLICT,
      );
    }

    const pipeline = await pipelineRepository.create(payload);
    await auditService.createAuditLog({
      tenantId: payload.tenantId,
      action: 'create',
      actorId,
      entityType: 'Pipeline',
      entityId: pipeline.id,
      metadata: { jobId: pipeline.jobId, candidateId: pipeline.candidateId, stage: pipeline.stage },
    });
    await cacheService.invalidateTenantPipelines(payload.tenantId, payload.jobId);
    await cacheService.invalidateMyApplications(payload.candidateId);
    await cacheService.invalidateJob(payload.tenantId, payload.jobId);
    return pipeline;
  },

  async getPipelineById(
    id: string,
    tenantId: string,
  ): Promise<Pipeline & { candidate: { firstName: string; lastName: string; email: string }; job: { title: string }; evaluations: any[] }> {
    const pipeline = await pipelineRepository.findByIdAndTenantWithRelations(id, tenantId);
    if (!pipeline) {
      throw new AppError('Pipeline record not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return pipeline;
  },

  async listPipelines(
    tenantId: string,
    input: { filters: PipelineListFilters; pagination: PaginationInput },
  ): Promise<{
    items: Array<
      Pipeline & {
        candidate: { firstName: string; lastName: string; email: string };
        job: { title: string };
        evaluations: any[];
      }
    >;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { filters, pagination } = input;
    const queryKey = pipelinesQueryKey(filters, pagination);
    const cacheKey = cacheKeys.pipelinesList(tenantId, queryKey);
    const result = await cacheService.getOrSet(cacheKey, CACHE_LIST_TTL, async () => {
      const listed = await pipelineRepository.listByTenant(tenantId, filters, pagination);
      const totalPages = Math.max(1, Math.ceil(listed.total / pagination.limit));
      return {
        items: listed.items,
        total: listed.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages,
      };
    });
    return result;
  },

  async advanceStage(
    id: string,
    tenantId: string,
    newStage: string,
    note: string | undefined,
    actorId?: string,
  ): Promise<Pipeline> {
    const currentPipeline = await prisma.pipeline.findFirst({
      where: { id, tenantId },
      include: { job: true },
    });

    if (!currentPipeline) {
      throw new AppError('Pipeline record not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    assertValidStageTransition(currentPipeline.stage, newStage);

    // Enforce forward-only progression
    const customStages = Array.isArray(currentPipeline.job.customStages) ? currentPipeline.job.customStages : null;
    let orderedStageKeys: string[] = ['applied', 'screening', 'technical_interview', 'hr_interview', 'offer', 'hired', 'rejected'];

    if (customStages) {
      orderedStageKeys = [...customStages]
        .filter((s: any) => s.enabled !== false)
        .sort((a: any, b: any) => a.order - b.order)
        .map((s: any) => s.stage);
    }

    const currentIndex = orderedStageKeys.indexOf(currentPipeline.stage);
    const nextIndex = orderedStageKeys.indexOf(newStage);

    if (currentIndex !== -1 && nextIndex !== -1 && nextIndex <= currentIndex) {
      throw new AppError(
        'Pipeline stages can only progress forward. You cannot move a candidate backward.',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.INVALID_STAGE_TRANSITION
      );
    }

    const nextCandidateStatus = resolveCandidateStatusFromStage(newStage);

    let existingNotes: any[] = [];
    if (currentPipeline.notes) {
      try {
        existingNotes = JSON.parse(currentPipeline.notes);
        if (!Array.isArray(existingNotes)) existingNotes = [];
      } catch {
        // If it's a legacy string note, we could optionally preserve it or just ignore it
        existingNotes = [];
      }
    }

    if (note) {
      const user = actorId ? await prisma.user.findUnique({ where: { id: actorId } }) : null;
      const authorName = user ? `${user.firstName} ${user.lastName}` : 'System';
      const formattedStageName = newStage.replace('_', ' ');
      existingNotes.push({
        author: authorName,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        note: `[Moved to ${formattedStageName}] ${note}`,
      });
    }

    const updatedPipeline = await prisma.$transaction(async (tx) => {
      const updated = await tx.pipeline.update({
        where: { id: currentPipeline.id },
        data: {
          stage: newStage,
          ...(note ? { decisionNote: note } : {}),
          notes: JSON.stringify(existingNotes)
        },
      });
      await tx.candidate.update({
        where: { id: currentPipeline.candidateId },
        data: { status: nextCandidateStatus },
      });
      return updated;
    });

    await auditService.createAuditLog({
      tenantId,
      action: 'update',
      actorId,
      entityType: 'Pipeline',
      entityId: updatedPipeline.id,
      metadata: { from: currentPipeline.stage, to: updatedPipeline.stage, note },
    });

    // Fire-and-forget — never throw from this block
    try {
      const pipelineWithRelations = await pipelineRepository.findByIdAndTenantWithRelations(updatedPipeline.id, tenantId);
      if (pipelineWithRelations) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true, company: { select: { companyName: true } } },
        });

        const companyName = tenant?.company?.companyName ?? tenant?.name ?? 'Kofeko';
        const candidateEmail = pipelineWithRelations.candidate.email;
        const candidateName = `${pipelineWithRelations.candidate.firstName} ${pipelineWithRelations.candidate.lastName}`.trim();
        const jobTitle = pipelineWithRelations.job.title;

        if (newStage === 'offer') {
          await communicationService.sendOfferNotification({
            tenantId,
            candidateEmail,
            candidateName,
            jobTitle,
            companyName,
          });
        } else if (newStage === 'rejected') {
          await communicationService.sendRejectionEmail({
            tenantId,
            candidateEmail,
            candidateName,
            jobTitle,
            companyName,
          });
        } else {
          await communicationService.sendStageAdvanceNotification({
            tenantId,
            candidateEmail,
            candidateName,
            jobTitle,
            companyName,
            newStage,
          });
        }
      }
    } catch {
      // fire-and-forget
    }

    await cacheService.invalidateTenantPipelines(tenantId, currentPipeline.jobId);
    await cacheService.invalidateMyApplications(currentPipeline.candidateId, id);
    return updatedPipeline;
  },

  async assignInterviewer(id: string, tenantId: string, userId: string, actorId?: string): Promise<Pipeline> {
    const currentPipeline = await pipelineRepository.findByIdAndTenant(id, tenantId);
    if (!currentPipeline) {
      throw new AppError('Pipeline record not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const hasRole = await prisma.userRole.findFirst({
      where: {
        tenantId,
        userId,
        role: { name: { in: [ROLE_NAMES.INTERVIEWER, ROLE_NAMES.RECRUITER] } },
      },
    });
    if (!hasRole) {
      throw new AppError(
        'User must be an interviewer or recruiter',
        StatusCodes.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const updated = await pipelineRepository.updateByIdAndTenant(id, tenantId, { assignedTo: userId });
    await auditService.createAuditLog({
      tenantId,
      action: 'update',
      actorId,
      entityType: 'Pipeline',
      entityId: updated.id,
      metadata: { assignedTo: userId },
    });

    try {
      const pipelineWithRelations = await pipelineRepository.findByIdAndTenantWithRelations(updated.id, tenantId);
      if (pipelineWithRelations) {
        const candidateName = `${pipelineWithRelations.candidate.firstName} ${pipelineWithRelations.candidate.lastName}`.trim();
        const jobTitle = pipelineWithRelations.job.title;
        await communicationService.sendInterviewerAssignmentEmail({
          tenantId,
          interviewerEmail: user.email,
          interviewerName: `${user.firstName} ${user.lastName}`.trim(),
          candidateName,
          jobTitle,
          stage: pipelineWithRelations.stage,
        });
      }
    } catch {
      // fire-and-forget
    }

    return updated;
  },

  async setPipelineSLA(id: string, tenantId: string, deadline: Date, actorId?: string): Promise<Pipeline> {
    const now = new Date();
    if (!(deadline instanceof Date) || Number.isNaN(deadline.getTime()) || deadline <= now) {
      throw new AppError('SLA deadline must be in the future', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const updated = await pipelineRepository.updateByIdAndTenant(id, tenantId, { slaDeadline: deadline });
    await auditService.createAuditLog({
      tenantId,
      action: 'update',
      actorId,
      entityType: 'Pipeline',
      entityId: updated.id,
      metadata: { deadline: deadline.toISOString() },
    });
    return updated;
  },

  async updatePipeline(id: string, tenantId: string, payload: UpdatePipelineInput, actorId?: string): Promise<Pipeline> {
    const currentPipeline = await pipelineRepository.findByIdAndTenant(id, tenantId);
    if (!currentPipeline) {
      throw new AppError('Pipeline record not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const updated = await pipelineRepository.updateByIdAndTenant(id, tenantId, payload);
    await auditService.createAuditLog({
      tenantId,
      action: 'update',
      actorId,
      entityType: 'Pipeline',
      entityId: updated.id,
      metadata: { before: currentPipeline, after: updated },
    });
    return updated;
  },

  async addNote(id: string, tenantId: string, noteText: string, actorId?: string) {
    const pipeline = await pipelineRepository.findByIdAndTenant(id, tenantId);
    if (!pipeline) {
      throw new AppError('Pipeline record not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    let authorName = 'System';
    if (actorId) {
      const user = await prisma.user.findUnique({ where: { id: actorId } });
      if (user) {
        authorName = `${user.firstName} ${user.lastName}`.trim();
      }
    }

    let existingNotes: any[] = [];
    if (pipeline.notes) {
      try {
        existingNotes = JSON.parse(pipeline.notes);
        if (!Array.isArray(existingNotes)) existingNotes = [];
      } catch {
        existingNotes = [];
      }
    }

    existingNotes.push({
      author: authorName,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      note: noteText,
    });
    return prisma.pipeline.update({
      where: { id: pipeline.id },
      data: { notes: JSON.stringify(existingNotes) },
    });
  },
};
