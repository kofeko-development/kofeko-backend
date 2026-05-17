import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .refine((value) => /[A-Z]/.test(value), 'Password must contain at least 1 uppercase letter')
  .refine((value) => /\d/.test(value), 'Password must contain at least 1 number');

export const candidateRegisterSchema = z.object({
  body: z
    .object({
      tenantSlug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
      firstName: z.string().min(1).max(80),
      lastName: z.string().min(1).max(80),
      email: z.email(),
      password: passwordSchema,
    })
    .strict(),
});

export const candidateLoginSchema = z.object({
  body: z
    .object({
      tenantSlug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
      email: z.email(),
      password: z.string().min(1),
    })
    .strict(),
});

export const candidateRefreshSchema = z.object({
  body: z
    .object({
      refreshToken: z.string().min(10),
    })
    .strict(),
});

export const portalJobsQuerySchema = z.object({
  params: z.object({
    tenantSlug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  }),
  query: z.object({
    department: z.string().min(1).max(100).optional(),
    search: z.string().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const portalAllJobsQuerySchema = z.object({
  query: z.object({
    search: z.string().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const portalJobIdParamSchema = z.object({
  params: z.object({
    tenantSlug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
    jobId: z.string().uuid(),
  }),
});

export const portalAnyJobIdParamSchema = z.object({
  params: z.object({
    jobId: z.string().uuid(),
  }),
});

export const applyToJobSchema = z.object({
  params: z.object({
    tenantSlug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
    jobId: z.string().uuid(),
  }),
  body: z
    .object({
      resumeUrl: z.string().url().optional(),
      resumeMimeType: z.string().min(1).max(100).optional(),
      coverLetter: z.string().max(2000).optional(),
    })
    .strict(),
});

export const myApplicationsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const portalPipelineIdParamSchema = z.object({
  params: z.object({
    pipelineId: z.string().uuid(),
  }),
});

export const updatePortalProfileSchema = z.object({
  body: z
    .object({
      firstName: z.string().min(1).max(80).optional(),
      lastName: z.string().min(1).max(80).optional(),
      phone: z.string().min(5).max(30).optional(),
      linkedinUrl: z.string().url().nullable().or(z.literal('')).optional(),
      portfolioUrl: z.string().url().nullable().or(z.literal('')).optional(),
      expectedSalary: z.number().nonnegative().optional(),
      noticePeriod: z.number().int().nonnegative().optional(),
      skills: z.array(z.string().min(1).max(50)).max(100).optional(),
      location: z.string().min(1).max(100).optional(),
      summary: z.string().max(2000).optional(),
      education: z.array(z.any()).optional(),
      workExperience: z.array(z.any()).optional(),
      projects: z.array(z.any()).optional(),
      hobbies: z.array(z.string()).optional(),
    })
    .strict(),
});

