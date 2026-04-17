import { Evaluation } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { buildEvaluationWhyCard } from '../../common/ai/evaluationWhyCard';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { PaginationInput } from '../../common/utils/pagination';
import { auditService } from '../audit/audit.service';
import { evaluationRepository } from '../../repositories/evaluation/evaluation.repository';
import { CreateEvaluationInput, EvaluationInsightPreviewInput, UpdateEvaluationInput } from '../../types/evaluation/evaluation.types';

export const evaluationService = {
  async createEvaluation(payload: CreateEvaluationInput): Promise<Evaluation> {
    const evaluationInput = {
      ...payload,
      whyCard: payload.whyCard?.trim() || buildEvaluationWhyCard({
        score: payload.score,
        summary: payload.summary,
      }),
    };
    const evaluation = await evaluationRepository.create(evaluationInput);
    await auditService.createAuditLog({
      tenantId: payload.tenantId,
      action: 'evaluate',
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

  async getEvaluationById(id: string): Promise<Evaluation> {
    const evaluation = await evaluationRepository.findById(id);
    if (!evaluation) {
      throw new AppError('Evaluation not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return evaluation;
  },

  async listEvaluationsByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: Evaluation[]; total: number }> {
    return evaluationRepository.listByTenant(tenantId, pagination);
  },

  async updateEvaluation(id: string, payload: UpdateEvaluationInput): Promise<Evaluation> {
    const currentEvaluation = await this.getEvaluationById(id);
    const nextScore = payload.score ?? currentEvaluation.score;
    const nextSummary = payload.summary ?? currentEvaluation.summary ?? undefined;
    const updatedEvaluation = await evaluationRepository.updateById(id, {
      ...payload,
      whyCard: payload.whyCard?.trim() || buildEvaluationWhyCard({
        score: nextScore,
        summary: nextSummary,
      }),
    });
    await auditService.createAuditLog({
      tenantId: currentEvaluation.tenantId,
      action: 'update',
      entityType: 'Evaluation',
      entityId: updatedEvaluation.id,
      metadata: { before: currentEvaluation, after: updatedEvaluation },
    });
    return updatedEvaluation;
  },

  previewEvaluationInsight(payload: EvaluationInsightPreviewInput): { whyCard: string } {
    return {
      whyCard: buildEvaluationWhyCard(payload),
    };
  },
};
