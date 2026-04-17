import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  createPipeline,
  getPipeline,
  listPipelines,
  updatePipeline,
} from '../../controllers/pipeline/pipeline.controller';
import {
  createPipelineSchema,
  pipelineIdParamSchema,
  pipelineListQuerySchema,
  updatePipelineSchema,
} from '../../validations/pipeline/pipeline.validation';

const pipelineRouter = Router();

pipelineRouter.post(
  '/',
  authenticate,
  authorize([PERMISSIONS.PIPELINE_CREATE]),
  validateRequest(createPipelineSchema),
  createPipeline,
);
pipelineRouter.get(
  '/',
  authenticate,
  authorize([PERMISSIONS.PIPELINE_READ]),
  validateRequest(pipelineListQuerySchema),
  listPipelines,
);
pipelineRouter.get(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.PIPELINE_READ]),
  validateRequest(pipelineIdParamSchema),
  getPipeline,
);
pipelineRouter.patch(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.PIPELINE_UPDATE]),
  validateRequest(updatePipelineSchema),
  updatePipeline,
);

export default pipelineRouter;
