import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  createMetric,
  getDashboardSummary,
  getHiringVelocity,
  getPipelineFunnel,
  getRecentActivity,
  getScoreDistribution,
  getSlaSummary,
  getTimeToDecision,
  listMetrics,
} from '../../controllers/analytics/analytics.controller';
import {
  analyticsTenantQuerySchema,
  createMetricSchema,
} from '../../validations/analytics/analytics.validation';
import { analyticsSummaryQuerySchema } from '../../validations/analytics/analytics.summary.validation';

const analyticsRouter = Router();

/**
 * @openapi
 * /api/v1/analytics/metrics:
 *   post:
 *     tags: [Analytics]
 *     summary: Create custom metric
 */
analyticsRouter.post(
  '/metrics',
  authenticate,
  authorize([PERMISSIONS.ANALYTICS_CREATE]),
  validateRequest(createMetricSchema),
  createMetric,
);

/**
 * @openapi
 * /api/v1/analytics/metrics:
 *   get:
 *     tags: [Analytics]
 *     summary: List metrics
 */
analyticsRouter.get(
  '/metrics',
  authenticate,
  authorize([PERMISSIONS.ANALYTICS_READ]),
  validateRequest(analyticsTenantQuerySchema),
  listMetrics,
);

/**
 * @openapi
 * /api/v1/analytics/summary:
 *   get:
 *     tags: [Analytics]
 *     summary: Tenant dashboard summary
 */
analyticsRouter.get(
  '/summary',
  authenticate,
  authorize([PERMISSIONS.ANALYTICS_READ]),
  validateRequest(analyticsSummaryQuerySchema),
  getDashboardSummary,
);

/**
 * @openapi
 * /api/v1/analytics/pipeline-funnel:
 *   get:
 *     tags: [Analytics]
 *     summary: Pipeline funnel counts by stage
 */
analyticsRouter.get(
  '/pipeline-funnel',
  authenticate,
  authorize([PERMISSIONS.ANALYTICS_READ]),
  validateRequest(analyticsSummaryQuerySchema),
  getPipelineFunnel,
);

/**
 * @openapi
 * /api/v1/analytics/time-to-decision:
 *   get:
 *     tags: [Analytics]
 *     summary: Average time to decision (hired/rejected)
 */
analyticsRouter.get(
  '/time-to-decision',
  authenticate,
  authorize([PERMISSIONS.ANALYTICS_READ]),
  validateRequest(analyticsSummaryQuerySchema),
  getTimeToDecision,
);

/**
 * @openapi
 * /api/v1/analytics/score-distribution:
 *   get:
 *     tags: [Analytics]
 *     summary: Evaluation score distribution buckets
 */
analyticsRouter.get(
  '/score-distribution',
  authenticate,
  authorize([PERMISSIONS.ANALYTICS_READ]),
  validateRequest(analyticsSummaryQuerySchema),
  getScoreDistribution,
);

/**
 * @openapi
 * /api/v1/analytics/recent-activity:
 *   get:
 *     tags: [Analytics]
 *     summary: Recent audit activity
 */
analyticsRouter.get(
  '/recent-activity',
  authenticate,
  authorize([PERMISSIONS.ANALYTICS_READ]),
  validateRequest(analyticsSummaryQuerySchema),
  getRecentActivity,
);

/**
 * @openapi
 * /api/v1/analytics/hiring-velocity:
 *   get:
 *     tags: [Analytics]
 *     summary: Hiring velocity over recent months
 */
analyticsRouter.get(
  '/hiring-velocity',
  authenticate,
  authorize([PERMISSIONS.ANALYTICS_READ]),
  validateRequest(analyticsSummaryQuerySchema),
  getHiringVelocity,
);

/**
 * @openapi
 * /api/v1/analytics/sla:
 *   get:
 *     tags: [Analytics]
 *     summary: SLA summary for pipelines
 */
analyticsRouter.get(
  '/sla',
  authenticate,
  authorize([PERMISSIONS.ANALYTICS_READ]),
  validateRequest(analyticsSummaryQuerySchema),
  getSlaSummary,
);

export default analyticsRouter;
