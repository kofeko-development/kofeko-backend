import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { prisma } from '../../config/prisma';

const resolveTenantBySlug = async (tenantSlug: string) => {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) {
    throw new AppError('Company not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }
  return tenant;
};

export const portalJobService = {
  async listAllOpenJobs(input: { search?: string; page: number; limit: number }) {
    const skip = (input.page - 1) * input.limit;

    const where = {
      status: 'open' as const,
      ...(input.search
        ? {
          OR: [
            { title: { contains: input.search, mode: 'insensitive' as const } },
            { description: { contains: input.search, mode: 'insensitive' as const } },
            { tenant: { name: { contains: input.search, mode: 'insensitive' as const } } },
            { tenant: { slug: { contains: input.search, mode: 'insensitive' as const } } },
          ],
        }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: input.limit,
        select: {
          id: true,
          title: true,
          department: true,
          description: true,
          location: true,
          employmentType: true,
          createdAt: true,
          tenant: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page: input.page,
      limit: input.limit,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    };
  },
  async listOpenJobs(
    tenantSlug: string,
    input: { department?: string; search?: string; page: number; limit: number },
  ) {
    const tenant = await resolveTenantBySlug(tenantSlug);
    const skip = (input.page - 1) * input.limit;

    const where = {
      tenantId: tenant.id,
      status: 'open' as const,
      ...(input.department ? { department: input.department } : {}),
      ...(input.search
        ? {
          OR: [
            { title: { contains: input.search, mode: 'insensitive' as const } },
            { description: { contains: input.search, mode: 'insensitive' as const } },
          ],
        }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: input.limit,
        select: {
          id: true,
          title: true,
          department: true,
          description: true,
          requirements: true,
          niceToHave: true,
          screeningQuestions: true,
          experienceMin: true,
          experienceMax: true,
          hiringPriority: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      items,
      total,
      page: input.page,
      limit: input.limit,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    };
  },

  async getOpenJobById(tenantSlug: string, jobId: string) {
    const tenant = await resolveTenantBySlug(tenantSlug);

    const job = await prisma.job.findFirst({
      where: { id: jobId, tenantId: tenant.id, status: 'open' as const },
      select: {
        id: true,
        title: true,
        department: true,
        description: true,
        requirements: true,
        niceToHave: true,
        screeningQuestions: true,
        experienceMin: true,
        experienceMax: true,
        hiringPriority: true,
        customStages: true,
        createdAt: true,
      },
    });

    if (!job) {
      throw new AppError('Job not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return job;
  },

  async getAnyOpenJobById(jobId: string) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, status: 'open' as const },
      select: {
        id: true,
        title: true,
        department: true,
        description: true,
        location: true,
        employmentType: true,
        requirements: true,
        niceToHave: true,
        screeningQuestions: true,
        experienceMin: true,
        experienceMax: true,
        hiringPriority: true,
        customStages: true,
        createdAt: true,
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            company: {
              select: {
                industry: true,
                companySize: true,
                companyType: true,
                companyLogo: true,
                shortDescription: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new AppError('Job not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return job;
  },
};

