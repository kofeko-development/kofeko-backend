import { z } from 'zod';

export const analyticsSummaryQuerySchema = z.object({
  query: z.object({
    jobId: z.uuid().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  }),
});
