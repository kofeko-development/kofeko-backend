import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  advanceStage,
  assignInterviewer,
  createPipeline,
  getPipeline,
  listPipelines,
  setPipelineSla,
  updatePipeline,
} from '../../controllers/pipeline/pipeline.controller';
import {
  advanceStageSchema,
  assignInterviewerSchema,
  createPipelineSchema,
  pipelineIdParamSchema,
  pipelineListQuerySchema,
  setPipelineSLASchema,
  updatePipelineSchema,
} from '../../validations/pipeline/pipeline.validation';

const pipelineRouter = Router();

/**
 * @openapi
 * /api/v1/pipelines:
 *   post:
 *     tags: [Pipeline]
 *     summary: Add candidate to job pipeline (create pipeline)
 */
pipelineRouter.post(
  '/',
  authenticate,
  authorize([PERMISSIONS.PIPELINE_CREATE]),
  validateRequest(createPipelineSchema),
  createPipeline,
);

/**
 * @openapi
 * /api/v1/pipelines:
 *   get:
 *     tags: [Pipeline]
 *     summary: List pipelines (tenant-scoped)
 */
pipelineRouter.get(
  '/',
  authenticate,
  authorize([PERMISSIONS.PIPELINE_READ]),
  validateRequest(pipelineListQuerySchema),
  listPipelines,
);

/**
 * @openapi
 * /api/v1/pipelines/{id}:
 *   get:
 *     tags: [Pipeline]
 *     summary: Get pipeline by id
 */
pipelineRouter.get(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.PIPELINE_READ]),
  validateRequest(pipelineIdParamSchema),
  getPipeline,
);

/**
 * @openapi
 * /api/v1/pipelines/{id}/advance:
 *   post:
 *     tags: [Pipeline]
 *     summary: Advance pipeline stage
 */
pipelineRouter.post(
  '/:id/advance',
  authenticate,
  authorize([PERMISSIONS.PIPELINE_UPDATE]),
  validateRequest(advanceStageSchema),
  advanceStage,
);

/**
 * @openapi
 * /api/v1/pipelines/{id}/assign:
 *   post:
 *     tags: [Pipeline]
 *     summary: Assign interviewer to pipeline
 */
pipelineRouter.post(
  '/:id/assign',
  authenticate,
  authorize([PERMISSIONS.PIPELINE_UPDATE]),
  validateRequest(assignInterviewerSchema),
  assignInterviewer,
);

/**
 * @openapi
 * /api/v1/pipelines/{id}/sla:
 *   post:
 *     tags: [Pipeline]
 *     summary: Set SLA deadline for pipeline
 */
pipelineRouter.post(
  '/:id/sla',
  authenticate,
  authorize([PERMISSIONS.PIPELINE_UPDATE]),
  validateRequest(setPipelineSLASchema),
  setPipelineSla,
);

/**
 * @openapi
 * /api/v1/pipelines/{id}:
 *   patch:
 *     tags: [Pipeline]
 *     summary: Update pipeline notes/decision fields
 */
pipelineRouter.patch(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.PIPELINE_UPDATE]),
  validateRequest(updatePipelineSchema),
  updatePipeline,
);

export default pipelineRouter;
