import { z } from 'zod';

export const analyticsSummaryQuerySchema = z.object({
  query: z.object({
    tenantId: z.uuid(),
  }),
});
