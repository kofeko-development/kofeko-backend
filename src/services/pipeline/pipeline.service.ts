import { Pipeline } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { communicationService } from '../communication/communication.service';
import { auditService } from '../audit/audit.service';
import { candidateRepository } from '../../repositories/candidate/candidate.repository';
import { jobRepository } from '../../repositories/job/job.repository';
import { pipelineRepository } from '../../repositories/pipeline/pipeline.repository';
import { PaginationInput } from '../../common/utils/pagination';
import { CreatePipelineInput, UpdatePipelineInput } from '../../types/pipeline/pipeline.types';
import { CandidateStatus, PipelineStage } from '@prisma/client';

const resolveCandidateStatusFromStage = (stage: PipelineStage): CandidateStatus => {
  switch (stage) {
    case 'applied':
      return 'new';
    case 'screening':
      return 'screened';
    case 'technical_interview':
    case 'hr_interview':
    case 'offer':
      return 'shortlisted';
    case 'hired':
      return 'hired';
    case 'rejected':
      return 'rejected';
    default:
      return 'screened';
  }
};

const allowedStageTransitions: Record<PipelineStage, PipelineStage[]> = {
  applied: ['screening', 'rejected'],
  screening: ['technical_interview', 'rejected'],
  technical_interview: ['hr_interview', 'rejected'],
  hr_interview: ['offer', 'rejected'],
  offer: ['hired', 'rejected'],
  hired: [],
  rejected: [],
};

const assertValidStageTransition = (currentStage: PipelineStage, nextStage: PipelineStage): void => {
  if (currentStage === nextStage) {
    return;
  }

  if (!allowedStageTransitions[currentStage].includes(nextStage)) {
    throw new AppError(
      `Invalid pipeline transition from ${currentStage} to ${nextStage}`,
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }
};

export const pipelineService = {
  async createPipeline(payload: CreatePipelineInput): Promise<Pipeline> {
    const pipeline = await pipelineRepository.create(payload);
    await auditService.createAuditLog({
      tenantId: payload.tenantId,
      action: 'create',
      entityType: 'Pipeline',
      entityId: pipeline.id,
      metadata: { jobId: pipeline.jobId, candidateId: pipeline.candidateId, stage: pipeline.stage },
    });
    return pipeline;
  },

  async getPipelineById(id: string): Promise<Pipeline> {
    const pipeline = await pipelineRepository.findById(id);
    if (!pipeline) {
      throw new AppError('Pipeline record not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return pipeline;
  },

  async listPipelinesByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: Pipeline[]; total: number }> {
    return pipelineRepository.listByTenant(tenantId, pagination);
  },

  async updatePipeline(id: string, payload: UpdatePipelineInput): Promise<Pipeline> {
    const currentPipeline = await this.getPipelineById(id);
    const currentCandidate = await candidateRepository.findById(currentPipeline.candidateId);
    const currentJob = await jobRepository.findById(currentPipeline.jobId);

    if (!currentCandidate) {
      throw new AppError('Pipeline candidate not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    if (!currentJob) {
      throw new AppError('Pipeline job not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const nextStage = payload.stage ?? currentPipeline.stage;

    if (payload.stage) {
      assertValidStageTransition(currentPipeline.stage, nextStage);
    }

    const candidateStatus = resolveCandidateStatusFromStage(nextStage);

    const updatedPipeline = await pipelineRepository.updateById(id, {
      ...payload,
      stage: nextStage,
    });

    if (payload.stage && payload.stage !== currentPipeline.stage) {
      await candidateRepository.updateById(currentCandidate.id, { status: candidateStatus });

      await communicationService.notifyPipelineStageChange({
        tenantId: currentPipeline.tenantId,
        recipient: currentCandidate.email,
        candidateName: `${currentCandidate.firstName} ${currentCandidate.lastName}`,
        jobTitle: currentJob.title,
        stage: nextStage,
      });
    }

    await auditService.createAuditLog({
      tenantId: currentPipeline.tenantId,
      action: 'update',
      entityType: 'Pipeline',
      entityId: updatedPipeline.id,
      metadata: {
        before: currentPipeline,
        after: updatedPipeline,
        candidateStatus,
      },
    });
    return updatedPipeline;
  },
};
