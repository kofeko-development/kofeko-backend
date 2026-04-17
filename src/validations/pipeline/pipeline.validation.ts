import { z } from 'zod';

export const createPipelineSchema = z.object({
  body: z.object({
    tenantId: z.uuid(),
    jobId: z.uuid(),
    candidateId: z.uuid(),
    stage: z.enum(['applied', 'screening', 'technical_interview', 'hr_interview', 'offer', 'hired', 'rejected']).optional(),
    notes: z.string().max(2000).optional(),
  }),
});

export const updatePipelineSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z.object({
    stage: z.enum(['applied', 'screening', 'technical_interview', 'hr_interview', 'offer', 'hired', 'rejected']).optional(),
    notes: z.string().max(2000).optional(),
  }),
});

export const pipelineIdParamSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const pipelineListQuerySchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});
