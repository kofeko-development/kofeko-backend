import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import { generateJd } from '../../controllers/ai/jdCreator.controller';
import { runEvaluationLab } from '../../controllers/ai/evaluationLab.controller';
import { generateJdSchema } from '../../validations/ai/jdCreator.validation';

const upload = multer({ storage: multer.memoryStorage() });
const aiRouter = Router();

/**
 * @openapi
 * /api/v1/ai/jd:
 *   post:
 *     tags: [AI]
 *     summary: Generate an HTML job description from requirements
 */
aiRouter.post('/jd', authenticate, authorize([PERMISSIONS.JOB_CREATE]), validateRequest(generateJdSchema), generateJd);

/**
 * @openapi
 * /api/v1/ai/evaluation-lab:
 *   post:
 *     tags: [AI]
 *     summary: Test AI scoring — evaluate multiple resumes against a JD (no DB writes)
 */
aiRouter.post(
  '/evaluation-lab',
  authenticate,
  authorize([PERMISSIONS.EVALUATION_CREATE]),
  upload.array('resumes', 30),
  runEvaluationLab,
);

export default aiRouter;

