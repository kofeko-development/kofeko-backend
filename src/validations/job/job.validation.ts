import { z } from 'zod';

const skillWeightSchema = z.object({
  skill: z.string().min(1).max(100),
  weight: z.number().int().min(0).max(10),
});

export const createJobSchema = z.object({
  body: z.object({
    title: z.string().min(2).max(200),
    description: z.string().min(10).max(5000),
    location: z.string().max(150).optional(),
    employmentType: z.string().max(80).optional(),
    openings: z.number().int().positive().max(1000).optional(),
    department: z.string().max(120).optional(),
    experienceMin: z.number().int().min(0).max(80).optional(),
    experienceMax: z.number().int().min(0).max(80).optional(),
    skillWeights: z.array(skillWeightSchema).max(30).optional(),
    requirements: z.string().max(5000).optional(),
    niceToHave: z.string().max(5000).optional(),
    screeningQuestions: z.array(z.string().min(1).max(500)).max(25).optional(),
    hiringPriority: z.enum(['high', 'medium', 'low']).optional(),
  }),
});

export const updateJobSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: createJobSchema.shape.body.partial(),
});

export const jobIdParamSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const jobIdParamSchemaV2 = z.object({
  params: z.object({ jobId: z.uuid() }),
});

export const jobListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.enum(['draft', 'open', 'paused', 'closed']).optional(),
    department: z.string().min(1).max(120).optional(),
  }),
});
