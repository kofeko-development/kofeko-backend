import { Router } from 'express';
import { createTenant, getTenant, updateTenant } from '../../controllers/tenant/tenant.controller';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  createTenantSchema,
  tenantIdParamSchema,
  updateTenantSchema,
} from '../../validations/tenant/tenant.validation';

const tenantRouter = Router();

tenantRouter.post(
  '/',
  authenticate,
  authorize([PERMISSIONS.RBAC_MANAGE]),
  validateRequest(createTenantSchema),
  createTenant,
);
tenantRouter.get(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.TENANT_READ]),
  validateRequest(tenantIdParamSchema),
  getTenant,
);
tenantRouter.patch(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.TENANT_UPDATE]),
  validateRequest(updateTenantSchema),
  updateTenant,
);

export default tenantRouter;
