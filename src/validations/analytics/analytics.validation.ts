import { z } from 'zod';

export const createMetricSchema = z.object({
  body: z.object({
    tenantId: z.uuid(),
    name: z.string().min(2).max(120),
    value: z.number(),
    dimension: z.string().max(120).optional(),
  }),
});

export const analyticsTenantQuerySchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});
