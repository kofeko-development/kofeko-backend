import { Candidate, CandidateStatus, Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { CreateCandidateInput, UpdateCandidateInput } from '../../types/candidate/candidate.types';

export const candidateRepository = {
  async create(data: CreateCandidateInput): Promise<Candidate> {
    return prisma.candidate.create({ data });
  },

  async findByIdAndTenant(id: string, tenantId: string): Promise<Candidate | null> {
    return prisma.candidate.findFirst({ where: { id, tenantId } });
  },

  async findByEmailInTenant(tenantId: string, email: string): Promise<Candidate | null> {
    return prisma.candidate.findFirst({ where: { tenantId, email } });
  },

  async listByTenant(
    tenantId: string,
    input: { page: number; limit: number; status?: CandidateStatus; skills?: string[] },
  ): Promise<{ items: Candidate[]; total: number }> {
    const where: Prisma.CandidateWhereInput = {
      tenantId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.skills?.length ? { skills: { hasSome: input.skills } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: {
          applications: {
            include: {
              job: {
                select: {
                  title: true,
                },
              },
            },
          },
        },
      }),
      prisma.candidate.count({ where }),
    ]);

    return { items, total };
  },

  async updateByIdAndTenant(id: string, tenantId: string, data: UpdateCandidateInput): Promise<Candidate> {
    const current = await prisma.candidate.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new AppError('Candidate not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return prisma.candidate.update({ where: { id: current.id }, data });
  },
};
