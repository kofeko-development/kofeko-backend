import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import { generateJd } from '../../controllers/ai/jdCreator.controller';
import { generateJdSchema } from '../../validations/ai/jdCreator.validation';

const aiRouter = Router();

/**
 * @openapi
 * /api/v1/ai/jd:
 *   post:
 *     tags: [AI]
 *     summary: Generate an HTML job description from requirements
 */
aiRouter.post('/jd', authenticate, authorize([PERMISSIONS.JOB_CREATE]), validateRequest(generateJdSchema), generateJd);

export default aiRouter;

