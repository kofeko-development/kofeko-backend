import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  createEvaluation,
  aiEvaluate,
  getEvaluation,
  listEvaluations,
  updateEvaluation,
} from '../../controllers/evaluation/evaluation.controller';
import {
  aiEvaluateSchema,
  createEvaluationSchema,
  evaluationIdParamSchema,
  evaluationListQuerySchema,
  updateEvaluationSchema,
} from '../../validations/evaluation/evaluation.validation';

const evaluationRouter = Router();

/**
 * @openapi
 * /api/v1/evaluations:
 *   post:
 *     tags: [Evaluation]
 *     summary: Create evaluation (manual)
 */
evaluationRouter.post(
  '/',
  authenticate,
  authorize([PERMISSIONS.EVALUATION_CREATE]),
  validateRequest(createEvaluationSchema),
  createEvaluation,
);

/**
 * @openapi
 * /api/v1/evaluations/ai-evaluate:
 *   post:
 *     tags: [Evaluation]
 *     summary: Run AI evaluation for a candidate against a job
 */
evaluationRouter.post(
  '/ai-evaluate',
  authenticate,
  authorize([PERMISSIONS.EVALUATION_CREATE]),
  validateRequest(aiEvaluateSchema),
  aiEvaluate,
);

/**
 * @openapi
 * /api/v1/evaluations:
 *   get:
 *     tags: [Evaluation]
 *     summary: List evaluations (tenant-scoped)
 */
evaluationRouter.get(
  '/',
  authenticate,
  authorize([PERMISSIONS.EVALUATION_READ]),
  validateRequest(evaluationListQuerySchema),
  listEvaluations,
);

/**
 * @openapi
 * /api/v1/evaluations/{id}:
 *   get:
 *     tags: [Evaluation]
 *     summary: Get evaluation by id
 */
evaluationRouter.get(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.EVALUATION_READ]),
  validateRequest(evaluationIdParamSchema),
  getEvaluation,
);

/**
 * @openapi
 * /api/v1/evaluations/{id}:
 *   patch:
 *     tags: [Evaluation]
 *     summary: Update evaluation (recruiter override)
 */
evaluationRouter.patch(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.EVALUATION_UPDATE]),
  validateRequest(updateEvaluationSchema),
  updateEvaluation,
);

export default evaluationRouter;
