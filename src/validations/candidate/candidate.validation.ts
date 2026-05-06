import { z } from 'zod';

export const createCandidateSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).max(80),
    lastName: z.string().min(1).max(80),
    email: z.email(),
    phoneNumber: z.string().min(6).max(20).optional(),
    resumeUrl: z.url().optional(),
    resumeMimeType: z.string().max(200).optional(),
    linkedinUrl: z.url().optional(),
    portfolioUrl: z.url().optional(),
    expectedSalary: z.number().min(0).max(1_000_000_000).optional(),
    noticePeriod: z.number().int().min(0).max(3650).optional(),
    skills: z.array(z.string().min(1).max(100)).optional(),
    location: z.string().max(150).optional(),
    source: z.enum(['referral', 'linkedin', 'job_board', 'direct', 'other']).optional(),
    currentCompany: z.string().max(120).optional(),
    yearsOfExperience: z.number().min(0).max(60).optional(),
    status: z.enum(['new', 'screening', 'interview', 'offer', 'hired', 'rejected']).optional(),
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
    status: z.enum(['new', 'screening', 'interview', 'offer', 'hired', 'rejected']).optional(),
    skills: z.string().optional(), // comma-separated
  }),
});

export const updateCandidateStatusSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z.object({
    status: z.enum(['new', 'screening', 'interview', 'offer', 'hired', 'rejected']),
  }),
});
