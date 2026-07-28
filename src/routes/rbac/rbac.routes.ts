import { Router } from 'express';
import {
  assignRoleToUser,
  attachPermissionToRole,
  createPermission,
  createRole,
  deleteRole,
  getRoles,
  getUserPermissions,
  updateRole,
} from '../../controllers/rbac/rbac.controller';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  createPermissionSchema,
  createRoleSchema,
  deleteRoleSchema,
  rolePermissionAssignmentSchema,
  updateRoleSchema,
  userPermissionQuerySchema,
  userRoleAssignmentSchema,
} from '../../validations/rbac/rbac.validation';

const rbacRouter = Router();

rbacRouter.get(
  '/roles',
  authenticate,
  authorize([PERMISSIONS.RBAC_MANAGE]),
  getRoles,
);
rbacRouter.post(
  '/roles',
  authenticate,
  authorize([PERMISSIONS.RBAC_MANAGE]),
  validateRequest(createRoleSchema),
  createRole,
);
rbacRouter.put(
  '/roles/:roleId',
  authenticate,
  authorize([PERMISSIONS.RBAC_MANAGE]),
  validateRequest(updateRoleSchema),
  updateRole,
);
rbacRouter.delete(
  '/roles/:roleId',
  authenticate,
  authorize([PERMISSIONS.RBAC_MANAGE]),
  validateRequest(deleteRoleSchema),
  deleteRole,
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
