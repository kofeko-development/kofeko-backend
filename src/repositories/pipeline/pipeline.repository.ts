import { Pipeline, PipelineStage, Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { PaginationInput } from '../../common/utils/pagination';
import { CreatePipelineInput, PipelineListFilters } from '../../types/pipeline/pipeline.types';

export const pipelineRepository = {
  async create(data: CreatePipelineInput): Promise<Pipeline> {
    return prisma.pipeline.create({ data: { ...data, stage: 'applied' } });
  },

  async findByIdAndTenant(id: string, tenantId: string): Promise<Pipeline | null> {
    return prisma.pipeline.findFirst({ where: { id, tenantId } });
  },

  async findByIdAndTenantWithRelations(
    id: string,
    tenantId: string,
  ): Promise<(Pipeline & { candidate: { firstName: string; lastName: string; email: string; resumeUrl: string | null; resumeMimeType: string | null }; job: { title: string }; evaluations: any[] }) | null> {
    return prisma.pipeline.findFirst({
      where: { id, tenantId },
      include: {
        candidate: { select: { firstName: true, lastName: true, email: true, resumeUrl: true, resumeMimeType: true } },
        job: { select: { title: true } },
        evaluations: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  },

  async findDuplicate(tenantId: string, jobId: string, candidateId: string): Promise<Pipeline | null> {
    return prisma.pipeline.findFirst({ where: { tenantId, jobId, candidateId } });
  },

  async listByTenant(
    tenantId: string,
    filters: PipelineListFilters,
    pagination: PaginationInput,
  ): Promise<{
    items: Array<
      Pipeline & { candidate: { firstName: string; lastName: string; email: string }; job: { title: string } }
    >;
    total: number;
  }> {
    const where: Prisma.PipelineWhereInput = {
      tenantId,
      ...(filters.jobId ? { jobId: filters.jobId } : {}),
      ...(filters.candidateId ? { candidateId: filters.candidateId } : {}),
      ...(filters.stage ? { stage: filters.stage as PipelineStage } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.pipeline.findMany({
        where,
        include: {
          candidate: { select: { firstName: true, lastName: true, email: true, resumeUrl: true, resumeMimeType: true } },
          job: { select: { title: true } },
          evaluations: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.pipeline.count({ where }),
    ]);

    return { items, total };
  },

  async listAllByJobIdAndTenant(
    tenantId: string,
    jobId: string,
  ): Promise<Array<Pipeline & { candidate: { firstName: string; lastName: string; email: string } }>> {
    return prisma.pipeline.findMany({
      where: { tenantId, jobId },
      include: { candidate: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async updateByIdAndTenant(
    id: string,
    tenantId: string,
    data: Prisma.PipelineUncheckedUpdateInput,
  ): Promise<Pipeline> {
    const current = await prisma.pipeline.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new AppError('Pipeline not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return prisma.pipeline.update({ where: { id: current.id }, data });
  },
};
