import { z } from 'zod';

export const createJobSchema = z.object({
  body: z.object({
    tenantId: z.uuid(),
    title: z.string().min(2).max(200),
    description: z.string().min(10).max(5000),
    location: z.string().max(150).optional(),
    employmentType: z.string().max(80).optional(),
    status: z.enum(['draft', 'open', 'paused', 'closed']).optional(),
    openings: z.number().int().positive().max(1000).optional(),
  }),
});

export const updateJobSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: createJobSchema.shape.body.omit({ tenantId: true }).partial(),
});

export const jobIdParamSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const jobListQuerySchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});
