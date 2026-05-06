import { AuditLog } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { CreateAuditLogInput } from '../../types/audit/audit.types';

export const auditRepository = {
  async createAuditLog(data: CreateAuditLogInput): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        ...data,
        metadata: data.metadata as never,
      },
    });
  },

  async findByIdAndTenant(id: string, tenantId: string): Promise<AuditLog | null> {
    return prisma.auditLog.findFirst({ where: { id, tenantId } });
  },

  async listAuditLogs(
    tenantId: string,
    filters: { entityType?: string; entityId?: string; action?: string; actorId?: string },
    page: number,
    limit: number,
  ): Promise<{ items: AuditLog[]; total: number }> {
    const where = {
      tenantId,
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.action ? { action: filters.action as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  },

  async listAuditLogsByTenant(tenantId: string, page: number, limit: number): Promise<{ items: AuditLog[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where: { tenantId } }),
    ]);

    return { items, total };
  },
};
