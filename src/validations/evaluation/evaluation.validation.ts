import { z } from 'zod';

export const createEvaluationSchema = z.object({
  body: z.object({
    tenantId: z.uuid(),
    jobId: z.uuid(),
    candidateId: z.uuid(),
    pipelineId: z.uuid().optional(),
    score: z.number().min(0).max(100),
    summary: z.string().max(3000).optional(),
    whyCard: z.string().max(3000).optional(),
    evaluatedBy: z.string().max(120).optional(),
  }),
});

export const updateEvaluationSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z.object({
    score: z.number().min(0).max(100).optional(),
    summary: z.string().max(3000).optional(),
    whyCard: z.string().max(3000).optional(),
    evaluatedBy: z.string().max(120).optional(),
    pipelineId: z.uuid().optional(),
  }),
});

export const evaluationIdParamSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const evaluationListQuerySchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const evaluationInsightPreviewSchema = z.object({
  body: z.object({
    score: z.number().min(0).max(100),
    summary: z.string().max(3000).optional(),
    candidateName: z.string().max(160).optional(),
    jobTitle: z.string().max(200).optional(),
  }),
});
