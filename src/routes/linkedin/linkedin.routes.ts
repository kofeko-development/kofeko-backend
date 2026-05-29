import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import * as ctrl from '../../controllers/linkedin/linkedin.controller';
import {
  autoPostSchema,
  jobImageParamSchema,
  jobPostsParamSchema,
  previewJobIdParamSchema,
  recordCopySchema,
  recordShareSchema,
  setOrganizationSchema,
  updatePreferenceSchema,
} from '../../validations/linkedin/linkedin.validation';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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
router.patch(
  '/preference',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_CONNECT]),
  validateRequest(updatePreferenceSchema),
  ctrl.updatePreference,
);
router.post(
  '/refresh-organization',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_CONNECT]),
  ctrl.refreshOrganization,
);
router.patch(
  '/organization',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_CONNECT]),
  validateRequest(setOrganizationSchema),
  ctrl.setOrganization,
);
router.delete(
  '/disconnect',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_CONNECT]),
  ctrl.disconnect,
);
router.post(
  '/jobs/:jobId/image',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_POST]),
  validateRequest(jobImageParamSchema),
  upload.single('image'),
  ctrl.uploadJobImage,
);
router.delete(
  '/jobs/:jobId/image',
  authenticate,
  authorize([PERMISSIONS.LINKEDIN_POST]),
  validateRequest(jobImageParamSchema),
  ctrl.clearJobImage,
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
