import { Router } from 'express';
import { validateRequest } from '../../common/middlewares/validateRequest';
import {
  applyToJobSchema,
  candidateLoginSchema,
  candidateRefreshSchema,
  candidateRegisterSchema,
  myApplicationsQuerySchema,
  portalAllJobsQuerySchema,
  portalAnyJobIdParamSchema,
  portalJobIdParamSchema,
  portalJobsQuerySchema,
  portalPipelineIdParamSchema,
  updatePortalProfileSchema,
} from '../../validations/portal/portal.validation';
import {
  portalApplyToJob,
  portalGetAnyJob,
  portalGetJob,
  portalListAllJobs,
  portalListJobs,
  portalLoginCandidate,
  portalMe,
  portalMyApplicationById,
  portalMyApplications,
  portalRefresh,
  portalRegisterCandidate,
  portalUpdateProfile,
} from '../../controllers/portal/portal.controller';
import { authenticateCandidate } from '../../common/middlewares/authenticateCandidate';

const portalRouter = Router();

// Auth (public)
/**
 * @openapi
 * /api/v1/portal/auth/registerCandidate:
 *   post:
 *     tags: [Portal]
 *     summary: Candidate self-register for a company portal
 *     security: []
 */
portalRouter.post('/auth/registerCandidate', validateRequest(candidateRegisterSchema), portalRegisterCandidate);

/**
 * @openapi
 * /api/v1/portal/auth/loginCandidate:
 *   post:
 *     tags: [Portal]
 *     summary: Candidate login for a company portal
 *     security: []
 */
portalRouter.post('/auth/loginCandidate', validateRequest(candidateLoginSchema), portalLoginCandidate);

/**
 * @openapi
 * /api/v1/portal/auth/refresh:
 *   post:
 *     tags: [Portal]
 *     summary: Refresh candidate access token
 *     security: []
 */
portalRouter.post('/auth/refresh', validateRequest(candidateRefreshSchema), portalRefresh);

// Jobs (public)
/**
 * @openapi
 * /api/v1/portal/jobs:
 *   get:
 *     tags: [Portal]
 *     summary: List open jobs across all companies
 *     security: []
 */
portalRouter.get('/jobs', validateRequest(portalAllJobsQuerySchema), portalListAllJobs);

/**
 * @openapi
 * /api/v1/portal/jobs/{jobId}:
 *   get:
 *     tags: [Portal]
 *     summary: Get single open job by id
 *     security: []
 */
portalRouter.get('/jobs/:jobId', validateRequest(portalAnyJobIdParamSchema), portalGetAnyJob);

/**
 * @openapi
 * /api/v1/portal/{tenantSlug}/jobs:
 *   get:
 *     tags: [Portal]
 *     summary: List open jobs for a company
 *     security: []
 */
portalRouter.get('/:tenantSlug/jobs', validateRequest(portalJobsQuerySchema), portalListJobs);

/**
 * @openapi
 * /api/v1/portal/{tenantSlug}/jobs/{jobId}:
 *   get:
 *     tags: [Portal]
 *     summary: Get single open job for a company
 *     security: []
 */
portalRouter.get('/:tenantSlug/jobs/:jobId', validateRequest(portalJobIdParamSchema), portalGetJob);

// Candidate authenticated
/**
 * @openapi
 * /api/v1/portal/auth/me:
 *   get:
 *     tags: [Portal]
 *     summary: Get current candidate profile
 */
portalRouter.get('/auth/me', authenticateCandidate, portalMe);

/**
 * @openapi
 * /api/v1/portal/profile:
 *   patch:
 *     tags: [Portal]
 *     summary: Update candidate profile (portal)
 */
portalRouter.patch('/profile', authenticateCandidate, validateRequest(updatePortalProfileSchema), portalUpdateProfile);

/**
 * @openapi
 * /api/v1/portal/{tenantSlug}/jobs/{jobId}/apply:
 *   post:
 *     tags: [Portal]
 *     summary: Apply to a job in the company portal
 */
portalRouter.post('/:tenantSlug/jobs/:jobId/apply', authenticateCandidate, validateRequest(applyToJobSchema), portalApplyToJob);

/**
 * @openapi
 * /api/v1/portal/my-applications:
 *   get:
 *     tags: [Portal]
 *     summary: List current candidate applications
 */
portalRouter.get('/my-applications', authenticateCandidate, validateRequest(myApplicationsQuerySchema), portalMyApplications);

/**
 * @openapi
 * /api/v1/portal/my-applications/{pipelineId}:
 *   get:
 *     tags: [Portal]
 *     summary: Get single application by pipelineId
 */
portalRouter.get(
  '/my-applications/:pipelineId',
  authenticateCandidate,
  validateRequest(portalPipelineIdParamSchema),
  portalMyApplicationById,
);

export default portalRouter;

