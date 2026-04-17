import { Candidate } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { auditService } from '../audit/audit.service';
import { candidateRepository } from '../../repositories/candidate/candidate.repository';
import { CreateCandidateInput, UpdateCandidateInput } from '../../types/candidate/candidate.types';
import { PaginationInput } from '../../common/utils/pagination';

export const candidateService = {
  async createCandidate(payload: CreateCandidateInput): Promise<Candidate> {
    const candidate = await candidateRepository.create(payload);
    await auditService.createAuditLog({
      tenantId: payload.tenantId,
      action: 'create',
      entityType: 'Candidate',
      entityId: candidate.id,
      metadata: { email: candidate.email, status: candidate.status },
    });
    return candidate;
  },

  async getCandidateById(id: string): Promise<Candidate> {
    const candidate = await candidateRepository.findById(id);
    if (!candidate) {
      throw new AppError('Candidate not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return candidate;
  },

  async listCandidatesByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: Candidate[]; total: number }> {
    return candidateRepository.listByTenant(tenantId, pagination.page, pagination.limit);
  },

  async updateCandidate(id: string, payload: UpdateCandidateInput): Promise<Candidate> {
    const currentCandidate = await this.getCandidateById(id);
    const updatedCandidate = await candidateRepository.updateById(id, payload);
    await auditService.createAuditLog({
      tenantId: currentCandidate.tenantId,
      action: 'update',
      entityType: 'Candidate',
      entityId: updatedCandidate.id,
      metadata: { before: currentCandidate, after: updatedCandidate },
    });
    return updatedCandidate;
  },
};
