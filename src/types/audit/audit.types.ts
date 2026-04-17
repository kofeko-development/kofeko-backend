import { AuditActionType } from '@prisma/client';

export type CreateAuditLogInput = {
  tenantId: string;
  actorId?: string;
  action: AuditActionType;
  entityType: string;
  entityId: string;
  metadata?: unknown;
};
