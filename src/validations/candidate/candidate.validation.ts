import { z } from 'zod';

export const createCandidateSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).max(80),
    lastName: z.string().min(1).max(80),
    email: z.email(),
    phoneNumber: z.string().min(6).max(20).optional(),
    resumeUrl: z.url().optional(),
    currentCompany: z.string().max(120).optional(),
    yearsOfExperience: z.number().min(0).max(60).optional(),
    status: z.enum(['new', 'screened', 'shortlisted', 'rejected', 'hired']).optional(),
  }),
});

export const updateCandidateSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: createCandidateSchema.shape.body.omit({ email: true }).partial(),
});

export const candidateIdParamSchema = z.object({
  params: z.object({ id: z.uuid() }),
});

export const candidateListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});
