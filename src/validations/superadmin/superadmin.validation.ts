import { z } from 'zod';

export const superAdminLoginSchema = z.object({
  body: z.object({
    username: z.string().min(3),
    password: z.string().min(3),
  }),
});

export const approveCompanyRequestSchema = z.object({
  body: z.object({
    tenantSlug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
    adminEmail: z.email(),
    adminPassword: z.string().min(8).max(128),
    otp: z.string().min(4).max(12),
    reviewNotes: z.string().max(500).optional(),
  }),
});

export const rejectCompanyRequestSchema = z.object({
  body: z.object({
    reviewNotes: z.string().min(3).max(500),
  }),
});
