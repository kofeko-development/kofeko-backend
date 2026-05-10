import { z } from 'zod';

export const superAdminBootstrapSchema = z.object({
  body: z.object({
    email: z.email(),
    password: z.string().min(8).max(128),
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
  }),
});

export const superAdminLoginSchema = z.object({
  body: z.object({
    email: z.email(),
    password: z.string().min(8).max(128),
  }),
});

export const superAdminRefreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10),
  }),
});

export const superAdminLogoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10),
  }),
});

export const superAdminTenantListQuerySchema = z.object({
  query: z.object({
    status: z.enum(['active', 'suspended', 'pending']).optional(),
    search: z.string().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const superAdminTenantIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const superAdminSuspendTenantSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    reason: z.string().min(3).max(500),
  }),
});

const tenantSlugField = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits, and single hyphens between segments'),
);

export const superAdminCompanyRequestsQuerySchema = z.object({
  query: z.object({
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
  }),
});

export const superAdminApproveCompanyRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    tenantSlug: tenantSlugField,
    adminEmail: z.email(),
    adminPassword: z.string().min(8).max(128),
    otp: z.string().min(4).max(32),
    reviewNotes: z.string().min(3).max(500).optional(),
  }),
});

export const superAdminRejectCompanyRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    reviewNotes: z.string().min(3).max(500),
  }),
});
