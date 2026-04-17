import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import { createJob, getJob, listJobs, updateJob } from '../../controllers/job/job.controller';
import {
  createJobSchema,
  jobIdParamSchema,
  jobListQuerySchema,
  updateJobSchema,
} from '../../validations/job/job.validation';

const jobRouter = Router();

jobRouter.post(
  '/',
  authenticate,
  authorize([PERMISSIONS.JOB_CREATE]),
  validateRequest(createJobSchema),
  createJob,
);
jobRouter.get(
  '/',
  authenticate,
  authorize([PERMISSIONS.JOB_READ]),
  validateRequest(jobListQuerySchema),
  listJobs,
);
jobRouter.get(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.JOB_READ]),
  validateRequest(jobIdParamSchema),
  getJob,
);
jobRouter.patch(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.JOB_UPDATE]),
  validateRequest(updateJobSchema),
  updateJob,
);

export default jobRouter;
