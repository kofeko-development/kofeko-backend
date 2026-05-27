import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import * as ctrl from '../../controllers/linkedin/linkedin.controller';
import {
  autoPostSchema,
  jobPostsParamSchema,
  previewJobIdParamSchema,
  recordCopySchema,
  recordShareSchema,
} from '../../validations/linkedin/linkedin.validation';

const router = Router();

router.get(
  '/preview/:jobId',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_POST]),
  validateRequest(previewJobIdParamSchema),
  ctrl.getPreview,
);
router.post(
  '/record-copy',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_POST]),
  validateRequest(recordCopySchema),
  ctrl.recordCopy,
);
router.post(
  '/record-share',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_POST]),
  validateRequest(recordShareSchema),
  ctrl.recordShare,
);
router.get(
  '/auth',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_CONNECT]),
  ctrl.getAuthUrl,
);
router.get('/callback', ctrl.handleCallback);
router.get(
  '/status',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_READ]),
  ctrl.getStatus,
);
router.delete(
  '/disconnect',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_CONNECT]),
  ctrl.disconnect,
);
router.post(
  '/post',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_POST]),
  validateRequest(autoPostSchema),
  ctrl.autoPost,
);
router.get(
  '/posts/:jobId',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_READ]),
  validateRequest(jobPostsParamSchema),
  ctrl.getJobPosts,
);
router.get(
  '/posts',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_READ]),
  ctrl.getAllPosts,
);

export default router;
