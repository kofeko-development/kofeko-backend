import { z } from 'zod';
import { ROLE_NAMES } from '../../common/constants/roles';

export const createUserSchema = z.object({
  body: z.object({
    tenantId: z.uuid(),
    firstName: z.string().min(2).max(80),
    lastName: z.string().min(1).max(80),
    email: z.email(),
    password: z.string().min(8).max(128),
    roleName: z.enum([ROLE_NAMES.COMPANY_ADMIN, ROLE_NAMES.HR_MANAGER, ROLE_NAMES.RECRUITER, ROLE_NAMES.INTERVIEWER]).optional(),
  }),
});

export const inviteUserSchema = z.object({
  body: z.object({
    tenantId: z.uuid(),
    firstName: z.string().min(2).max(80),
    lastName: z.string().min(1).max(80),
    email: z.email(),
    roleName: z.enum([ROLE_NAMES.COMPANY_ADMIN, ROLE_NAMES.HR_MANAGER, ROLE_NAMES.RECRUITER, ROLE_NAMES.INTERVIEWER]).optional(),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.uuid(),
  }),
  body: z.object({
    firstName: z.string().min(2).max(80).optional(),
    lastName: z.string().min(1).max(80).optional(),
    status: z.enum(['active', 'invited', 'suspended']).optional(),
  }),
});

export const userIdParamSchema = z.object({
  params: z.object({
    id: z.uuid(),
  }),
});

export const userListQuerySchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
  }),
});
