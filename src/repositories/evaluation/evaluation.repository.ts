import { Evaluation } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationInput } from '../../common/utils/pagination';
import { CreateEvaluationInput, UpdateEvaluationInput } from '../../types/evaluation/evaluation.types';

export const evaluationRepository = {
  async create(data: CreateEvaluationInput): Promise<Evaluation> {
    return prisma.evaluation.create({ data });
  },

  async findByIdAndTenant(id: string, tenantId: string): Promise<Evaluation | null> {
    return prisma.evaluation.findFirst({ where: { id, tenantId } });
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
      throw new Error('Evaluation not found in tenant');
    }
    return prisma.evaluation.update({ where: { id: current.id }, data });
  },
};
