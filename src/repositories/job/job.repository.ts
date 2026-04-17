import { Job } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { CreateJobInput, UpdateJobInput } from '../../types/job/job.types';

export const jobRepository = {
  async create(data: CreateJobInput): Promise<Job> {
    return prisma.job.create({ data });
  },

  async findById(id: string): Promise<Job | null> {
    return prisma.job.findUnique({ where: { id } });
  },

  async listByTenant(tenantId: string, page: number, limit: number): Promise<{ items: Job[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.job.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where: { tenantId } }),
    ]);

    return { items, total };
  },

  async updateById(id: string, data: UpdateJobInput): Promise<Job> {
    return prisma.job.update({ where: { id }, data });
  },
};
