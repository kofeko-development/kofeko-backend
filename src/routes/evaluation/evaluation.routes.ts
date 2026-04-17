import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  createEvaluation,
  getEvaluation,
  listEvaluations,
  previewEvaluationInsight,
  updateEvaluation,
} from '../../controllers/evaluation/evaluation.controller';
import {
  createEvaluationSchema,
  evaluationIdParamSchema,
  evaluationInsightPreviewSchema,
  evaluationListQuerySchema,
  updateEvaluationSchema,
} from '../../validations/evaluation/evaluation.validation';

const evaluationRouter = Router();

evaluationRouter.post(
  '/',
  authenticate,
  authorize([PERMISSIONS.EVALUATION_CREATE]),
  validateRequest(createEvaluationSchema),
  createEvaluation,
);
evaluationRouter.get(
  '/',
  authenticate,
  authorize([PERMISSIONS.EVALUATION_READ]),
  validateRequest(evaluationListQuerySchema),
  listEvaluations,
);
evaluationRouter.post(
  '/preview',
  authenticate,
  authorize([PERMISSIONS.EVALUATION_READ]),
  validateRequest(evaluationInsightPreviewSchema),
  previewEvaluationInsight,
);
evaluationRouter.get(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.EVALUATION_READ]),
  validateRequest(evaluationIdParamSchema),
  getEvaluation,
);
evaluationRouter.patch(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.EVALUATION_UPDATE]),
  validateRequest(updateEvaluationSchema),
  updateEvaluation,
);

export default evaluationRouter;
