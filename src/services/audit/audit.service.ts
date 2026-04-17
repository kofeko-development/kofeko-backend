import { AuditLog } from '@prisma/client';
import { auditRepository } from '../../repositories/audit/audit.repository';
import { CreateAuditLogInput } from '../../types/audit/audit.types';
import { PaginationInput } from '../../common/utils/pagination';

export const auditService = {
  async createAuditLog(payload: CreateAuditLogInput): Promise<AuditLog> {
    return auditRepository.createAuditLog(payload);
  },

  async listAuditLogsByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: AuditLog[]; total: number }> {
    return auditRepository.listAuditLogsByTenant(tenantId, pagination.page, pagination.limit);
  },
};
