import { z } from 'zod';

export const registerAdminSchema = z.object({
  body: z.object({
    tenantName: z.string().min(2).max(120),
    tenantSlug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
    firstName: z.string().min(2).max(80),
    lastName: z.string().min(1).max(80),
    email: z.email(),
    password: z.string().min(8).max(128),
  }),
});

export const registerCandidateSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).max(80),
    lastName: z.string().min(1).max(80),
    email: z.email(),
    password: z.string().min(8).max(128),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    tenantSlug: z.string().min(2).max(60),
    email: z.email(),
    password: z.string().min(8).max(128),
  }),
});

export const loginCandidateSchema = z.object({
  body: z.object({
    email: z.email(),
    password: z.string().min(8).max(128),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10),
  }),
});

export const logoutSchema = refreshSchema;
