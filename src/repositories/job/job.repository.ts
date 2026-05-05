import { Job } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { CreateJobInput, UpdateJobInput } from '../../types/job/job.types';

export const jobRepository = {
  async create(data: CreateJobInput): Promise<Job> {
    return prisma.job.create({ data });
  },

  async findByIdAndTenant(id: string, tenantId: string): Promise<Job | null> {
    return prisma.job.findFirst({ where: { id, tenantId } });
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

  async updateByIdAndTenant(id: string, tenantId: string, data: UpdateJobInput): Promise<Job> {
    const current = await prisma.job.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new Error('Job not found in tenant');
    }
    return prisma.job.update({
      where: { id: current.id },
      data,
    });
  },
};
