import { Router } from 'express';
import {
  approveCompanyRequest,
  listCompanyRequests,
  rejectCompanyRequest,
  superAdminLogin,
} from '../../controllers/superadmin/superadmin.controller';
import { validateRequest } from '../../common/middlewares/validateRequest';
import {
  approveCompanyRequestSchema,
  rejectCompanyRequestSchema,
  superAdminLoginSchema,
} from '../../validations/superadmin/superadmin.validation';
import { authenticateSuperAdmin } from '../../common/middlewares/authenticateSuperAdmin';

const superAdminRouter = Router();

superAdminRouter.post('/login', validateRequest(superAdminLoginSchema), superAdminLogin);
superAdminRouter.get('/requests', authenticateSuperAdmin, listCompanyRequests);
superAdminRouter.post(
  '/requests/:id/approve',
  authenticateSuperAdmin,
  validateRequest(approveCompanyRequestSchema),
  approveCompanyRequest,
);
superAdminRouter.post(
  '/requests/:id/reject',
  authenticateSuperAdmin,
  validateRequest(rejectCompanyRequestSchema),
  rejectCompanyRequest,
);

export default superAdminRouter;
