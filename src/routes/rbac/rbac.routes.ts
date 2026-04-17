import { Router } from 'express';
import {
  assignRoleToUser,
  attachPermissionToRole,
  createPermission,
  createRole,
  getUserPermissions,
} from '../../controllers/rbac/rbac.controller';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  createPermissionSchema,
  createRoleSchema,
  rolePermissionAssignmentSchema,
  userPermissionQuerySchema,
  userRoleAssignmentSchema,
} from '../../validations/rbac/rbac.validation';

const rbacRouter = Router();

rbacRouter.post(
  '/roles',
  authenticate,
  authorize([PERMISSIONS.RBAC_MANAGE]),
  validateRequest(createRoleSchema),
  createRole,
);
rbacRouter.post(
  '/permissions',
  authenticate,
  authorize([PERMISSIONS.RBAC_MANAGE]),
  validateRequest(createPermissionSchema),
  createPermission,
);
rbacRouter.post(
  '/roles/:roleId/permissions/:permissionId',
  authenticate,
  authorize([PERMISSIONS.RBAC_MANAGE]),
  validateRequest(rolePermissionAssignmentSchema),
  attachPermissionToRole,
);
rbacRouter.post(
  '/users/:userId/roles/:roleId',
  authenticate,
  authorize([PERMISSIONS.RBAC_MANAGE]),
  validateRequest(userRoleAssignmentSchema),
  assignRoleToUser,
);
rbacRouter.get(
  '/users/:userId/permissions',
  authenticate,
  authorize([PERMISSIONS.RBAC_MANAGE]),
  validateRequest(userPermissionQuerySchema),
  getUserPermissions,
);

export default rbacRouter;
