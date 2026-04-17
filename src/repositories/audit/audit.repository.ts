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
