import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  closeJob,
  createJob,
  deleteJob,
  evaluateAllForJob,
  getJob,
  getJobRankings,
  importDemoCandidates,
  installDemoCandidates,
  listJobs,
  pauseJob,
  publishJob,
  removeDemoCandidates,
  updateJob,
} from '../../controllers/job/job.controller';
import {
  createJobSchema,
  jobIdParamSchema,
  jobIdParamSchemaV2,
  jobListQuerySchema,
  updateJobSchema,
} from '../../validations/job/job.validation';

const jobRouter = Router();
const demoPackUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 50 },
});

/**
 * @openapi
 * /api/v1/jobs:
 *   post:
 *     tags: [Jobs]
 *     summary: Create job (draft by default)
 */
jobRouter.post(
  '/',
  authenticate,
  authorize([PERMISSIONS.JOB_CREATE]),
  validateRequest(createJobSchema),
  createJob,
);

/**
 * @openapi
 * /api/v1/jobs:
 *   get:
 *     tags: [Jobs]
 *     summary: List jobs (tenant-scoped)
 */
jobRouter.get(
  '/',
  authenticate,
  authorize([PERMISSIONS.JOB_READ]),
  validateRequest(jobListQuerySchema),
  listJobs,
);

/**
 * @openapi
 * /api/v1/jobs/{id}:
 *   get:
 *     tags: [Jobs]
 *     summary: Get job by id
 */
jobRouter.get(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.JOB_READ]),
  validateRequest(jobIdParamSchema),
  getJob,
);

/**
 * @openapi
 * /api/v1/jobs/{id}:
 *   patch:
 *     tags: [Jobs]
 *     summary: Update job
 */
jobRouter.patch(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.JOB_UPDATE]),
  validateRequest(updateJobSchema),
  updateJob,
);

/**
 * @openapi
 * /api/v1/jobs/{id}/publish:
 *   post:
 *     tags: [Jobs]
 *     summary: Publish job (set status=open)
 */
jobRouter.post(
  '/:id/publish',
  authenticate,
  authorize([PERMISSIONS.JOB_UPDATE]),
  validateRequest(jobIdParamSchema),
  publishJob,
);

/**
 * @openapi
 * /api/v1/jobs/{id}/pause:
 *   post:
 *     tags: [Jobs]
 *     summary: Pause job (set status=paused)
 */
jobRouter.post(
  '/:id/pause',
  authenticate,
  authorize([PERMISSIONS.JOB_UPDATE]),
  validateRequest(jobIdParamSchema),
  pauseJob,
);

/**
 * @openapi
 * /api/v1/jobs/{id}/close:
 *   post:
 *     tags: [Jobs]
 *     summary: Close job (set status=closed)
 */
jobRouter.post(
  '/:id/close',
  authenticate,
  authorize([PERMISSIONS.JOB_UPDATE]),
  validateRequest(jobIdParamSchema),
  closeJob,
);

/**
 * @openapi
 * /api/v1/jobs/{id}:
 *   delete:
 *     tags: [Jobs]
 *     summary: Delete draft job
 */
jobRouter.delete(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.JOB_UPDATE]),
  validateRequest(jobIdParamSchema),
  deleteJob,
);

/**
 * @openapi
 * /api/v1/jobs/{jobId}/evaluate-all:
 *   post:
 *     tags: [Jobs]
 *     summary: Trigger AI evaluation for all candidates in a job
 */
jobRouter.post(
  '/:jobId/evaluate-all',
  authenticate,
  authorize([PERMISSIONS.EVALUATION_CREATE]),
  validateRequest(jobIdParamSchemaV2),
  evaluateAllForJob,
);

/**
 * @openapi
 * /api/v1/jobs/demo-candidates/install:
 *   post:
 *     tags: [Jobs]
 *     summary: Upload the demo candidate pack (multipart pack JSON + resumes) into this company
 * /api/v1/jobs/{jobId}/demo-candidates:
 *   post:
 *     tags: [Jobs]
 *     summary: Apply the demo candidate pack to a job (only for accounts in DEMO_IMPORT_EMAILS)
 *   delete:
 *     tags: [Jobs]
 *     summary: Remove the demo candidates' applications from a job
 */
jobRouter.post(
  '/demo-candidates/install',
  authenticate,
  authorize([PERMISSIONS.CANDIDATE_CREATE]),
  demoPackUpload.array('resumes', 50),
  installDemoCandidates,
);

jobRouter.post(
  '/:jobId/demo-candidates',
  authenticate,
  authorize([PERMISSIONS.PIPELINE_CREATE]),
  validateRequest(jobIdParamSchemaV2),
  importDemoCandidates,
);

jobRouter.delete(
  '/:jobId/demo-candidates',
  authenticate,
  authorize([PERMISSIONS.PIPELINE_CREATE]),
  validateRequest(jobIdParamSchemaV2),
  removeDemoCandidates,
);

/**
 * @openapi
 * /api/v1/jobs/{jobId}/rankings:
 *   get:
 *     tags: [Jobs]
 *     summary: Get rankings for a job (sorted by evaluation score)
 */
jobRouter.get(
  '/:jobId/rankings',
  authenticate,
  authorize([PERMISSIONS.EVALUATION_READ]),
  validateRequest(jobIdParamSchemaV2),
  getJobRankings,
);

export default jobRouter;
