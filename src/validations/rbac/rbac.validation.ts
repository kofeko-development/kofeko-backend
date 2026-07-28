import { z } from 'zod';

export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80),
    description: z.string().max(250).optional(),
    permissionKeys: z.array(z.string()).optional(),
  }),
});

export const updateRoleSchema = z.object({
  params: z.object({
    roleId: z.uuid(),
  }),
  body: z.object({
    name: z.string().min(2).max(80),
    description: z.string().max(250).optional(),
    permissionKeys: z.array(z.string()).min(1),
  }),
});

export const deleteRoleSchema = z.object({
  params: z.object({
    roleId: z.uuid(),
  }),
  body: z.object({}).optional(),
});

export const createPermissionSchema = z.object({
  body: z.object({
    key: z.string().min(2).max(120),
    description: z.string().max(250).optional(),
  }),
});

export const rolePermissionAssignmentSchema = z.object({
  params: z.object({
    roleId: z.uuid(),
    permissionId: z.uuid(),
  }),
  body: z.object({}),
});

export const userRoleAssignmentSchema = z.object({
  params: z.object({
    userId: z.uuid(),
    roleId: z.uuid(),
  }),
  body: z.object({}),
});

export const userPermissionQuerySchema = z.object({
  params: z.object({
    userId: z.uuid(),
  }),
  query: z.object({}),
});
