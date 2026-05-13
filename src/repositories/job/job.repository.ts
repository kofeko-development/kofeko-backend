import { Job, JobStatus, Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { CreateJobInput, UpdateJobInput } from '../../types/job/job.types';

export const jobRepository = {
  async create(data: CreateJobInput): Promise<Job> {
    return prisma.job.create({ data });
  },

  async findByIdAndTenant(id: string, tenantId: string): Promise<Job | null> {
    return prisma.job.findFirst({ where: { id, tenantId } });
  },

  async listByTenant(
    tenantId: string,
    input: { page: number; limit: number; status?: JobStatus; department?: string },
  ): Promise<{ items: Job[]; total: number }> {
    const { page, limit, status, department } = input;
    const where: Prisma.JobWhereInput = {
      tenantId,
      ...(status ? { status } : {}),
      ...(department ? { department } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    return { items, total };
  },

  async updateByIdAndTenant(id: string, tenantId: string, data: UpdateJobInput): Promise<Job> {
    const current = await prisma.job.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new AppError('Job not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return prisma.job.update({
      where: { id: current.id },
      data,
    });
  },

  async deleteByIdAndTenant(id: string, tenantId: string): Promise<void> {
    const current = await prisma.job.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new AppError('Job not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    await prisma.job.delete({ where: { id: current.id } });
  },
};
