import { Request, Response } from 'express';
import { requireStringValue } from '../../common/utils/requestValue';
import { eventBus } from '../../common/events/eventBus';
import { logger } from '../../common/logger/logger';

export const streamJobUpdates = (req: Request, res: Response): void => {
  const jobId = requireStringValue(req.params.jobId, 'jobId');
  const tenantId = String(req.user?.tenantId);

  if (!tenantId || tenantId === 'undefined') {
    res.status(401).json({ success: false, message: 'Unauthorized access' });
    return;
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering on Nginx/proxies
  res.flushHeaders();

  logger.info({ jobId, tenantId }, 'Client connected to realtime job update stream');

  // Send initial ping to confirm connection
  res.write(`data: ${JSON.stringify({ event: 'connected', jobId })}\n\n`);

  const onUpdate = (payload: { tenantId: string; jobId: string }) => {
    if (payload.tenantId === tenantId && payload.jobId === jobId) {
      logger.debug({ jobId, tenantId }, 'Streaming application update to client');
      res.write(`data: ${JSON.stringify({ event: 'applications_updated', jobId })}\n\n`);
    }
  };

  eventBus.onTyped('job:applications_updated', onUpdate);

  // Keep connection alive with periodic heartbeats every 25 seconds
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    logger.info({ jobId, tenantId }, 'Client disconnected from realtime stream');
    clearInterval(heartbeatInterval);
    eventBus.offTyped('job:applications_updated', onUpdate);
  });
};
