import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  createMetric,
  getDashboardSummary,
  getSlaSummary,
  listMetrics,
} from '../../controllers/analytics/analytics.controller';
import {
  analyticsTenantQuerySchema,
  createMetricSchema,
} from '../../validations/analytics/analytics.validation';
import { analyticsSummaryQuerySchema } from '../../validations/analytics/analytics.summary.validation';

const analyticsRouter = Router();

analyticsRouter.post(
  '/metrics',
  authenticate,
  authorize([PERMISSIONS.ANALYTICS_CREATE]),
  validateRequest(createMetricSchema),
  createMetric,
);
analyticsRouter.get(
  '/metrics',
  authenticate,
  authorize([PERMISSIONS.ANALYTICS_READ]),
  validateRequest(analyticsTenantQuerySchema),
  listMetrics,
);
analyticsRouter.get(
  '/summary',
  authenticate,
  authorize([PERMISSIONS.ANALYTICS_READ]),
  validateRequest(analyticsSummaryQuerySchema),
  getDashboardSummary,
);
analyticsRouter.get(
  '/sla',
  authenticate,
  authorize([PERMISSIONS.ANALYTICS_READ]),
  validateRequest(analyticsSummaryQuerySchema),
  getSlaSummary,
);

export default analyticsRouter;
