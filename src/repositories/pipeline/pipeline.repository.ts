import { Pipeline } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationInput } from '../../common/utils/pagination';
import { CreatePipelineInput, UpdatePipelineInput } from '../../types/pipeline/pipeline.types';

export const pipelineRepository = {
  async create(data: CreatePipelineInput): Promise<Pipeline> {
    return prisma.pipeline.create({ data });
  },

  async findByIdAndTenant(id: string, tenantId: string): Promise<Pipeline | null> {
    return prisma.pipeline.findFirst({ where: { id, tenantId } });
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

  async updateByIdAndTenant(id: string, tenantId: string, data: UpdatePipelineInput): Promise<Pipeline> {
    const current = await prisma.pipeline.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new Error('Pipeline not found in tenant');
    }
    return prisma.pipeline.update({ where: { id: current.id }, data });
  },
};
