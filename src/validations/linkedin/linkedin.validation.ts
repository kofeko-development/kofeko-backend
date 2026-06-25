import { z } from 'zod';

export const previewJobIdParamSchema = z.object({
  params: z.object({
    jobId: z.uuid(),
  }),
});

export const jobPostsParamSchema = z.object({
  params: z.object({
    jobId: z.uuid(),
  }),
});

export const jobImageParamSchema = z.object({
  params: z.object({
    jobId: z.uuid(),
  }),
});

export const recordCopySchema = z.object({
  body: z.object({
    jobId: z.uuid(),
    postText: z.string().min(1).max(3000),
  }),
});

export const recordShareSchema = z.object({
  body: z.object({
    jobId: z.uuid(),
    postText: z.string().min(1).max(3000),
    shareUrl: z.string().url(),
  }),
});

export const autoPostSchema = z.object({
  body: z.object({
    jobId: z.uuid(),
    customText: z.string().max(3000).optional(),
    connectionIds: z.array(z.string()).optional(),
  }),
});

export const updatePreferenceSchema = z.object({
  body: z.object({
    postAsOrg: z.boolean(),
  }),
});

export const setOrganizationSchema = z.object({
  body: z.object({
    orgId: z.string().min(1).max(200),
    orgName: z.string().max(200).optional(),
  }),
});
