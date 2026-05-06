import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  createCandidate,
  getCandidate,
  listCandidates,
  uploadResume,
  updateCandidate,
  updateCandidateStatus,
} from '../../controllers/candidate/candidate.controller';
import {
  candidateIdParamSchema,
  candidateListQuerySchema,
  createCandidateSchema,
  updateCandidateStatusSchema,
  updateCandidateSchema,
} from '../../validations/candidate/candidate.validation';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const candidateRouter = Router();

/**
 * @openapi
 * /api/v1/candidates/upload-resume:
 *   post:
 *     tags: [Candidates]
 *     summary: Upload candidate resume (PDF/DOCX/TXT)
 */
candidateRouter.post(
  '/upload-resume',
  authenticate,
  authorize([PERMISSIONS.CANDIDATE_CREATE]),
  upload.single('resume'),
  uploadResume,
);

/**
 * @openapi
 * /api/v1/candidates:
 *   post:
 *     tags: [Candidates]
 *     summary: Create candidate
 */
candidateRouter.post(
  '/',
  authenticate,
  authorize([PERMISSIONS.CANDIDATE_CREATE]),
  validateRequest(createCandidateSchema),
  createCandidate,
);

/**
 * @openapi
 * /api/v1/candidates:
 *   get:
 *     tags: [Candidates]
 *     summary: List candidates (tenant-scoped)
 */
candidateRouter.get(
  '/',
  authenticate,
  authorize([PERMISSIONS.CANDIDATE_READ]),
  validateRequest(candidateListQuerySchema),
  listCandidates,
);

/**
 * @openapi
 * /api/v1/candidates/{id}:
 *   get:
 *     tags: [Candidates]
 *     summary: Get candidate by id
 */
candidateRouter.get(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.CANDIDATE_READ]),
  validateRequest(candidateIdParamSchema),
  getCandidate,
);

/**
 * @openapi
 * /api/v1/candidates/{id}:
 *   patch:
 *     tags: [Candidates]
 *     summary: Update candidate
 */
candidateRouter.patch(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.CANDIDATE_UPDATE]),
  validateRequest(updateCandidateSchema),
  updateCandidate,
);

/**
 * @openapi
 * /api/v1/candidates/{id}/status:
 *   patch:
 *     tags: [Candidates]
 *     summary: Update candidate status
 */
candidateRouter.patch(
  '/:id/status',
  authenticate,
  authorize([PERMISSIONS.CANDIDATE_UPDATE]),
  validateRequest(updateCandidateStatusSchema),
  updateCandidateStatus,
);

export default candidateRouter;
