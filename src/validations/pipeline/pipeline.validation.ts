import { z } from 'zod';


export const createPipelineSchema = z.object({
  body: z.object({
    jobId: z.uuid(),
    candidateId: z.uuid(),
  }),
});

export const updatePipelineSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z.object({
    decisionNote: z.string().max(5000).optional(),
    slaDeadline: z.coerce.date().optional(),
  }),
});

export const pipelineIdParamSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const pipelineListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    jobId: z.uuid().optional(),
    candidateId: z.uuid().optional(),
    stage: z.string().min(1).max(100).optional(),
  }),
});

export const advanceStageSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z.object({
    stage: z.string().min(1).max(100),
    note: z.string().max(5000).optional(),
  }),
});

export const assignInterviewerSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z.object({
    userId: z.uuid(),
  }),
});

export const setPipelineSLASchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z.object({
    deadline: z.coerce.date(),
  }),
});
