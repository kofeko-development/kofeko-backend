import { z } from 'zod';

export const createNotificationSchema = z.object({
  body: z.object({
    channel: z.enum(['email', 'sms', 'in_app']),
    title: z.string().min(2).max(200),
    body: z.string().min(2).max(4000),
    recipient: z.string().min(2).max(200),
    status: z.string().max(60).optional(),
  }),
});

export const createMessageSchema = z.object({
  body: z.object({
    subject: z.string().min(2).max(200),
    body: z.string().min(2).max(4000),
    recipient: z.string().min(2).max(200),
    direction: z.string().max(60).optional(),
  }),
});

export const tenantQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const notificationIdParamSchema = z.object({
  params: z.object({ id: z.uuid() }),
});
