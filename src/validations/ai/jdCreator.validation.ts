import { z } from 'zod';

export const generateJdSchema = z.object({
  body: z.object({
    jobTitle: z.string().min(2).max(140),
    requirements: z.string().min(10).max(10_000),
    location: z.string().max(120).optional(),
    jobType: z.string().max(60).optional(),
    employmentType: z.string().max(60).optional(),
  }),
});

