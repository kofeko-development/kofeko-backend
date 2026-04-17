import { Candidate } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { CreateCandidateInput, UpdateCandidateInput } from '../../types/candidate/candidate.types';

export const candidateRepository = {
  async create(data: CreateCandidateInput): Promise<Candidate> {
    return prisma.candidate.create({ data });
  },

  async findById(id: string): Promise<Candidate | null> {
    return prisma.candidate.findUnique({ where: { id } });
  },

  async listByTenant(tenantId: string, page: number, limit: number): Promise<{ items: Candidate[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.candidate.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.candidate.count({ where: { tenantId } }),
    ]);

    return { items, total };
  },

  async updateById(id: string, data: UpdateCandidateInput): Promise<Candidate> {
    return prisma.candidate.update({ where: { id }, data });
  },
};
