import { z } from 'zod';

export const createAuditLogSchema = z.object({
  body: z.object({
    tenantId: z.uuid(),
    actorId: z.uuid().optional(),
    action: z.enum(['create', 'update', 'delete', 'login', 'logout', 'evaluate']),
    entityType: z.string().min(2).max(120),
    entityId: z.string().min(1).max(120),
    metadata: z.unknown().optional(),
  }),
});

export const auditTenantQuerySchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});
