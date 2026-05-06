import { Evaluation, Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { PaginationInput } from '../../common/utils/pagination';
import { CreateEvaluationInput, UpdateEvaluationInput } from '../../types/evaluation/evaluation.types';

export const evaluationRepository = {
  async create(data: CreateEvaluationInput): Promise<Evaluation> {
    return prisma.evaluation.create({ data: data as Prisma.EvaluationUncheckedCreateInput });
  },

  async findByIdAndTenant(id: string, tenantId: string): Promise<Evaluation | null> {
    return prisma.evaluation.findFirst({ where: { id, tenantId } });
  },

  async findAiGeneratedByJobCandidate(
    tenantId: string,
    jobId: string,
    candidateId: string,
  ): Promise<Evaluation | null> {
    return prisma.evaluation.findFirst({
      where: { tenantId, jobId, candidateId, aiGenerated: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findAiGeneratedByPipeline(tenantId: string, pipelineId: string): Promise<Evaluation | null> {
    return prisma.evaluation.findFirst({
      where: { tenantId, pipelineId, aiGenerated: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async listAiGeneratedByJobWithRelations(
    tenantId: string,
    jobId: string,
  ): Promise<
    Array<
      Evaluation & {
        candidate: { id: string; firstName: string; lastName: string; email: string };
        pipeline: { id: string; stage: string } | null;
      }
    >
  > {
    return prisma.evaluation.findMany({
      where: { tenantId, jobId, aiGenerated: true },
      orderBy: { score: 'desc' },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
        pipeline: { select: { id: true, stage: true } },
      },
    });
  },

  async listByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: Evaluation[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.evaluation.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.evaluation.count({ where: { tenantId } }),
    ]);

    return { items, total };
  },

  async updateByIdAndTenant(id: string, tenantId: string, data: UpdateEvaluationInput): Promise<Evaluation> {
    const current = await prisma.evaluation.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new AppError('Evaluation not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return prisma.evaluation.update({ where: { id: current.id }, data: data as Prisma.EvaluationUncheckedUpdateInput });
  },
};
