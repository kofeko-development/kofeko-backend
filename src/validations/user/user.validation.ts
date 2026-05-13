import { z } from 'zod';
import { ROLE_NAMES } from '../../common/constants/roles';

export const createUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).max(80),
    lastName: z.string().min(1).max(80),
    email: z.email(),
    password: z.string().min(8).max(128),
    roleName: z.enum([ROLE_NAMES.COMPANY_ADMIN, ROLE_NAMES.HR_MANAGER, ROLE_NAMES.RECRUITER, ROLE_NAMES.INTERVIEWER]).optional(),
  }),
});

export const inviteUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).max(80),
    lastName: z.string().min(1).max(80),
    email: z.email(),
    roleName: z.enum([ROLE_NAMES.COMPANY_ADMIN, ROLE_NAMES.HR_MANAGER, ROLE_NAMES.RECRUITER, ROLE_NAMES.INTERVIEWER]).optional(),
    /** Job title / custom role label (required when permissionKeys is used). */
    position: z.string().min(1).max(120).optional(),
    /** Custom permission set for invited user (creates a dedicated tenant role). */
    permissionKeys: z.array(z.string().min(2).max(80)).max(60).optional(),
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
    roleName: z.enum([ROLE_NAMES.COMPANY_ADMIN, ROLE_NAMES.HR_MANAGER, ROLE_NAMES.RECRUITER, ROLE_NAMES.INTERVIEWER]).or(z.string()).optional(),
  }),
});

export const userIdParamSchema = z.object({
  params: z.object({
    id: z.uuid(),
  }),
});

export const userListQuerySchema = z.object({
  query: z.object({}),
});
