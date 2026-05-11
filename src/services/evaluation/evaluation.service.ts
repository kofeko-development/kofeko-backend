import { Evaluation } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { Buffer } from 'node:buffer';
import { extractResumeText } from '../../common/ai/extractResumeText';
import { analyzeResumeAgainstJD } from '../../common/ai/analyzeResume';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { PaginationInput } from '../../common/utils/pagination';
import { auditService } from '../audit/audit.service';
import { evaluationRepository } from '../../repositories/evaluation/evaluation.repository';
import { jobRepository } from '../../repositories/job/job.repository';
import { candidateRepository } from '../../repositories/candidate/candidate.repository';
import { pipelineRepository } from '../../repositories/pipeline/pipeline.repository';
import type { SkillWeight } from '../../types/ai/ai.types';
import { CreateEvaluationInput, UpdateEvaluationInput } from '../../types/evaluation/evaluation.types';

export const evaluationService = {
  async createEvaluation(payload: CreateEvaluationInput, actorId?: string): Promise<Evaluation> {
    const evaluation = await evaluationRepository.create(payload);
    await auditService.createAuditLog({
      tenantId: payload.tenantId,
      action: 'evaluate',
      actorId,
      entityType: 'Evaluation',
      entityId: evaluation.id,
      metadata: {
        jobId: evaluation.jobId,
        candidateId: evaluation.candidateId,
        score: evaluation.score,
        whyCard: evaluation.whyCard,
      },
    });
    return evaluation;
  },

  async getEvaluationById(id: string, tenantId: string): Promise<Evaluation> {
    const evaluation = await evaluationRepository.findByIdAndTenant(id, tenantId);
    if (!evaluation) {
      throw new AppError('Evaluation not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return evaluation;
  },

  async listEvaluationsByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: Evaluation[]; total: number }> {
    return evaluationRepository.listByTenant(tenantId, pagination);
  },

  async updateEvaluation(id: string, tenantId: string, payload: UpdateEvaluationInput, actorId?: string): Promise<Evaluation> {
    const currentEvaluation = await this.getEvaluationById(id, tenantId);
    const updatedEvaluation = await evaluationRepository.updateByIdAndTenant(id, tenantId, {
      ...payload,
      ...(payload.whyCard != null ? { whyCard: payload.whyCard.trim() } : {}),
    });
    await auditService.createAuditLog({
      tenantId: currentEvaluation.tenantId,
      action: 'update',
      actorId,
      entityType: 'Evaluation',
      entityId: updatedEvaluation.id,
      metadata: { before: currentEvaluation, after: updatedEvaluation },
    });
    return updatedEvaluation;
  },

  async aiEvaluate(
    payload: { jobId: string; candidateId: string; pipelineId?: string },
    tenantId: string,
    actorId?: string,
  ): Promise<Evaluation> {
    const job = await jobRepository.findByIdAndTenant(payload.jobId, tenantId);
    if (!job) {
      throw new AppError('Job not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const candidate = await candidateRepository.findByIdAndTenant(payload.candidateId, tenantId);
    if (!candidate) {
      throw new AppError('Candidate not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    if (!candidate.resumeUrl) {
      throw new AppError('Candidate has no resume uploaded', StatusCodes.BAD_REQUEST, ERROR_CODES.NO_RESUME);
    }

    let buffer: Buffer;
    try {
      const response = await fetch(candidate.resumeUrl);
      if (!response.ok) {
        throw new AppError(
          `Resume download failed with status ${response.status}`,
          StatusCodes.BAD_GATEWAY,
          ERROR_CODES.AI_EVALUATION_FAILED,
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Resume download failed';
      throw new AppError(`AI evaluation failed: ${message}`, StatusCodes.BAD_GATEWAY, ERROR_CODES.AI_EVALUATION_FAILED);
    }

    let resumeText = '';
    try {
      resumeText = await extractResumeText(
        buffer,
        candidate.resumeMimeType ?? 'application/pdf',
        candidate.resumeUrl.split('/').pop() ?? 'resume',
      );
    } catch {
      // If parsing fails, proceed with empty resume text.
    }

    let result: Awaited<ReturnType<typeof analyzeResumeAgainstJD>>;
    try {
      result = await analyzeResumeAgainstJD(resumeText, {
        title: job.title,
        description: job.description ?? '',
        skillWeights: (job.skillWeights as SkillWeight[]) ?? [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new AppError(`AI evaluation failed: ${message}`, StatusCodes.BAD_GATEWAY, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }

    const evaluation = await evaluationRepository.create({
      tenantId,
      jobId: payload.jobId,
      candidateId: payload.candidateId,
      pipelineId: payload.pipelineId ?? undefined,
      score: result.scores.overall,
      summary: result.parsedResume.summary,
      whyCard: result.rankingSummary,
      rankingSummary: result.rankingSummary,
      roleFitNotes: result.scores.roleFitNotes,
      sectionScores: result.scores.sections,
      skillMatches: result.scores.skillMatches,
      parsedResumeData: result.parsedResume,
      hiringIntelligence: result.hiringIntelligence,
      aiGenerated: true,
      evaluatedBy: actorId,
    });

    await auditService.createAuditLog({
      tenantId,
      action: 'ai_evaluate',
      actorId,
      entityType: 'evaluation',
      entityId: evaluation.id,
      metadata: {
        score: result.scores.overall,
        aiGenerated: true,
        candidateId: payload.candidateId,
        jobId: payload.jobId,
      },
    });

    return evaluation;
  },

  async batchAiEvaluate(
    jobId: string,
    tenantId: string,
    actorId?: string,
  ): Promise<{ evaluated: number; failed: number; errors: Array<{ candidateId: string; reason: string }> }> {
    const pipelines = await pipelineRepository.listAllByJobIdAndTenant(tenantId, jobId);
    let evaluated = 0;
    let failed = 0;
    const errors: Array<{ candidateId: string; reason: string }> = [];

    for (const pipeline of pipelines) {
      const existingAi =
        (await evaluationRepository.findAiGeneratedByPipeline(tenantId, pipeline.id)) ??
        (await evaluationRepository.findAiGeneratedByJobCandidate(tenantId, pipeline.jobId, pipeline.candidateId));
      if (existingAi) {
        continue;
      }

      try {
        await this.aiEvaluate(
          { jobId: pipeline.jobId, candidateId: pipeline.candidateId, pipelineId: pipeline.id },
          tenantId,
          actorId,
        );
        evaluated += 1;
      } catch (err) {
        failed += 1;
        errors.push({
          candidateId: pipeline.candidateId,
          reason: err instanceof Error ? err.message : 'AI evaluation failed',
        });
      }
    }

    return { evaluated, failed, errors };
  },

  async getRankings(
    jobId: string,
    tenantId: string,
  ): Promise<
    Array<{
      rank: number;
      candidate: { id: string; firstName: string; lastName: string; email: string };
      pipeline: { id: string; stage: string } | null;
      evaluation: {
        id: string;
        score: number;
        whyCard: string | null;
        roleFitNotes: string | null;
        skillMatches: unknown;
        sectionScores: unknown;
        aiGenerated: boolean;
      };
    }>
  > {
    const evaluations = await evaluationRepository.listAiGeneratedByJobWithRelations(tenantId, jobId);
    return evaluations.map((e, idx) => ({
      rank: idx + 1,
      candidate: e.candidate,
      pipeline: e.pipeline ? { id: e.pipeline.id, stage: e.pipeline.stage } : null,
      evaluation: {
        id: e.id,
        score: e.score,
        whyCard: e.whyCard,
        roleFitNotes: e.roleFitNotes,
        skillMatches: e.skillMatches,
        sectionScores: e.sectionScores,
        aiGenerated: e.aiGenerated,
      },
    }));
  },
};
