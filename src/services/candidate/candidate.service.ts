import { Candidate } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { auditService } from '../audit/audit.service';
import { candidateRepository } from '../../repositories/candidate/candidate.repository';
import { CreateCandidateInput, UpdateCandidateInput } from '../../types/candidate/candidate.types';
import { PaginationInput } from '../../common/utils/pagination';

export const candidateService = {
  async createCandidate(payload: CreateCandidateInput, actorId?: string): Promise<Candidate> {
    if (!payload.resumeUrl?.trim()) {
      throw new AppError('Resume is required to create a candidate', StatusCodes.BAD_REQUEST, ERROR_CODES.NO_RESUME);
    }

    const existing = await candidateRepository.findByEmailInTenant(payload.tenantId, payload.email);
    if (existing) {
      throw new AppError('Candidate with this email already exists', StatusCodes.CONFLICT, ERROR_CODES.CONFLICT);
    }

    const candidate = await candidateRepository.create({ ...payload, status: 'new' });
    await auditService.createAuditLog({
      tenantId: payload.tenantId,
      action: 'create',
      actorId,
      entityType: 'Candidate',
      entityId: candidate.id,
      metadata: { email: candidate.email, status: candidate.status },
    });
    return candidate;
  },

  async getCandidateById(id: string, tenantId: string): Promise<Candidate> {
    const candidate = await candidateRepository.findByIdAndTenant(id, tenantId);
    if (!candidate) {
      throw new AppError('Candidate not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return candidate;
  },

  async listCandidates(
    tenantId: string,
    input: { pagination: PaginationInput; status?: string; skills?: string[] },
  ): Promise<{ items: Candidate[]; total: number; page: number; limit: number; totalPages: number }> {
    const status = input.status as Candidate['status'] | undefined;
    const { page, limit } = input.pagination;
    const result = await candidateRepository.listByTenant(tenantId, {
      page,
      limit,
      status,
      skills: input.skills,
    });
    const totalPages = Math.max(1, Math.ceil(result.total / limit));
    return { items: result.items, total: result.total, page, limit, totalPages };
  },

  async updateCandidate(id: string, tenantId: string, payload: UpdateCandidateInput, actorId?: string): Promise<Candidate> {
    const currentCandidate = await this.getCandidateById(id, tenantId);
    const updatedCandidate = await candidateRepository.updateByIdAndTenant(id, tenantId, payload);
    await auditService.createAuditLog({
      tenantId: currentCandidate.tenantId,
      action: 'update',
      actorId,
      entityType: 'Candidate',
      entityId: updatedCandidate.id,
      metadata: { before: currentCandidate, after: updatedCandidate },
    });
    return updatedCandidate;
  },

  async updateCandidateStatus(id: string, tenantId: string, status: string, actorId?: string): Promise<Candidate> {
    const currentCandidate = await this.getCandidateById(id, tenantId);
    const to = status as Candidate['status'];
    const updatedCandidate = await candidateRepository.updateByIdAndTenant(id, tenantId, { status: to });
    await auditService.createAuditLog({
      tenantId,
      action: 'update',
      actorId,
      entityType: 'Candidate',
      entityId: updatedCandidate.id,
      metadata: { from: currentCandidate.status, to: updatedCandidate.status },
    });
    return updatedCandidate;
  },
};
