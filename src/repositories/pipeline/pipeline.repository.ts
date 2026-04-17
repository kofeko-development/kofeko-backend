import { Pipeline } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationInput } from '../../common/utils/pagination';
import { CreatePipelineInput, UpdatePipelineInput } from '../../types/pipeline/pipeline.types';

export const pipelineRepository = {
  async create(data: CreatePipelineInput): Promise<Pipeline> {
    return prisma.pipeline.create({ data });
  },

  async findById(id: string): Promise<Pipeline | null> {
    return prisma.pipeline.findUnique({ where: { id } });
  },

  async listByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: Pipeline[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.pipeline.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.pipeline.count({ where: { tenantId } }),
    ]);

    return { items, total };
  },

  async updateById(id: string, data: UpdatePipelineInput): Promise<Pipeline> {
    return prisma.pipeline.update({ where: { id }, data });
  },
};
