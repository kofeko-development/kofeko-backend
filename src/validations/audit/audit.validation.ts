import { z } from 'zod';

export const createAuditLogSchema = z.object({
  body: z.object({
    actorId: z.uuid().optional(),
    action: z.enum(['create', 'update', 'delete', 'login', 'logout', 'evaluate']),
    entityType: z.string().min(2).max(120),
    entityId: z.string().min(1).max(120),
    metadata: z.unknown().optional(),
  }),
});

export const auditTenantQuerySchema = z.object({
  query: z.object({
    entityType: z.string().min(1).max(120).optional(),
    entityId: z.string().min(1).max(120).optional(),
    action: z.string().min(1).max(120).optional(),
    actorId: z.uuid().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const auditIdParamSchema = z.object({
  params: z.object({ id: z.uuid() }),
});
