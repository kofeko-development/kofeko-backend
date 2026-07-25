import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { streamJobUpdates } from '../../controllers/realtime/realtime.controller';

const realtimeRouter = Router();

/**
 * @openapi
 * /api/v1/realtime/jobs/{jobId}/stream:
 *   get:
 *     tags: [Realtime]
 *     summary: Stream realtime updates for job applications (SSE)
 */
realtimeRouter.get('/jobs/:jobId/stream', authenticate, streamJobUpdates);

export default realtimeRouter;
