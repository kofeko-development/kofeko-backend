import { Evaluation } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationInput } from '../../common/utils/pagination';
import { CreateEvaluationInput, UpdateEvaluationInput } from '../../types/evaluation/evaluation.types';

export const evaluationRepository = {
  async create(data: CreateEvaluationInput): Promise<Evaluation> {
    return prisma.evaluation.create({ data });
  },

  async findById(id: string): Promise<Evaluation | null> {
    return prisma.evaluation.findUnique({ where: { id } });
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

  async updateById(id: string, data: UpdateEvaluationInput): Promise<Evaluation> {
    return prisma.evaluation.update({ where: { id }, data });
  },
};
