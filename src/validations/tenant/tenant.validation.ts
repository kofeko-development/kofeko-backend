import { z } from 'zod';

export const createTenantSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
    companyId: z.uuid().optional(),
  }),
});

export const updateTenantSchema = z.object({
  params: z.object({
    id: z.uuid(),
  }),
  body: createTenantSchema.shape.body.partial(),
});

export const tenantIdParamSchema = z.object({
  params: z.object({
    id: z.uuid(),
  }),
});
