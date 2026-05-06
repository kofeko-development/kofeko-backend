import { AuditLog } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { auditRepository } from '../../repositories/audit/audit.repository';
import { CreateAuditLogInput } from '../../types/audit/audit.types';
import { PaginationInput } from '../../common/utils/pagination';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';

export const auditService = {
  async createAuditLog(payload: CreateAuditLogInput): Promise<AuditLog> {
    return auditRepository.createAuditLog({
      ...payload,
      entityType: payload.entityType.trim().toLowerCase(),
    });
  },

  async listAuditLogs(
    tenantId: string,
    filters: { entityType?: string; entityId?: string; action?: string; actorId?: string },
    pagination: PaginationInput,
  ): Promise<{ items: AuditLog[]; total: number; page: number; limit: number; totalPages: number }> {
    const result = await auditRepository.listAuditLogs(
      tenantId,
      {
        ...filters,
        ...(filters.action ? { action: filters.action.trim().toLowerCase() } : {}),
        ...(filters.entityType ? { entityType: filters.entityType.trim().toLowerCase() } : {}),
      },
      pagination.page,
      pagination.limit,
    );
    const totalPages = Math.max(1, Math.ceil(result.total / pagination.limit));
    return { items: result.items, total: result.total, page: pagination.page, limit: pagination.limit, totalPages };
  },

  async getAuditLogById(id: string, tenantId: string): Promise<AuditLog> {
    const log = await auditRepository.findByIdAndTenant(id, tenantId);
    if (!log) {
      throw new AppError('Audit log not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return log;
  },

  async listAuditLogsByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: AuditLog[]; total: number }> {
    return auditRepository.listAuditLogsByTenant(tenantId, pagination.page, pagination.limit);
  },
};
