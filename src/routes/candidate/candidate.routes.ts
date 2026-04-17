import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  createCandidate,
  getCandidate,
  listCandidates,
  updateCandidate,
} from '../../controllers/candidate/candidate.controller';
import {
  candidateIdParamSchema,
  candidateListQuerySchema,
  createCandidateSchema,
  updateCandidateSchema,
} from '../../validations/candidate/candidate.validation';

const candidateRouter = Router();

candidateRouter.post(
  '/',
  authenticate,
  authorize([PERMISSIONS.CANDIDATE_CREATE]),
  validateRequest(createCandidateSchema),
  createCandidate,
);
candidateRouter.get(
  '/',
  authenticate,
  authorize([PERMISSIONS.CANDIDATE_READ]),
  validateRequest(candidateListQuerySchema),
  listCandidates,
);
candidateRouter.get(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.CANDIDATE_READ]),
  validateRequest(candidateIdParamSchema),
  getCandidate,
);
candidateRouter.patch(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.CANDIDATE_UPDATE]),
  validateRequest(updateCandidateSchema),
  updateCandidate,
);

export default candidateRouter;
