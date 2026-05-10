import { Router } from 'express';
import {
  superAdminBootstrap,
  superAdminActivateTenant,
  superAdminApproveCompanyRequest,
  superAdminGetTenant,
  superAdminListCompanyRequests,
  superAdminLogin,
  superAdminListTenants,
  superAdminLogout,
  superAdminMe,
  superAdminPlatformAnalytics,
  superAdminRefresh,
  superAdminRejectCompanyRequest,
  superAdminSuspendTenant,
} from '../../controllers/superadmin/superadmin.controller';
import { validateRequest } from '../../common/middlewares/validateRequest';
import {
  superAdminApproveCompanyRequestSchema,
  superAdminBootstrapSchema,
  superAdminCompanyRequestsQuerySchema,
  superAdminLoginSchema,
  superAdminLogoutSchema,
  superAdminRefreshSchema,
  superAdminRejectCompanyRequestSchema,
  superAdminSuspendTenantSchema,
  superAdminTenantIdParamSchema,
  superAdminTenantListQuerySchema,
} from '../../validations/superadmin/superadmin.validation';
import { authenticateSuperAdmin } from '../../common/middlewares/authenticateSuperAdmin';

const superAdminRouter = Router();

// Auth (no middleware)
/**
 * @openapi
 * /api/v1/superadmin/auth/bootstrap:
 *   post:
 *     tags: [SuperAdmin]
 *     summary: Bootstrap super admin account (one-time)
 *     security: []
 */
superAdminRouter.post('/auth/bootstrap', validateRequest(superAdminBootstrapSchema), superAdminBootstrap);

/**
 * @openapi
 * /api/v1/superadmin/auth/login:
 *   post:
 *     tags: [SuperAdmin]
 *     summary: Super admin login
 *     security: []
 */
superAdminRouter.post('/auth/login', validateRequest(superAdminLoginSchema), superAdminLogin);

/**
 * @openapi
 * /api/v1/superadmin/auth/refresh:
 *   post:
 *     tags: [SuperAdmin]
 *     summary: Refresh super admin access token
 *     security: []
 */
superAdminRouter.post('/auth/refresh', validateRequest(superAdminRefreshSchema), superAdminRefresh);

/**
 * @openapi
 * /api/v1/superadmin/auth/logout:
 *   post:
 *     tags: [SuperAdmin]
 *     summary: Logout super admin (revoke refresh session)
 *     security: []
 */
superAdminRouter.post('/auth/logout', validateRequest(superAdminLogoutSchema), superAdminLogout);

// Protected
/**
 * @openapi
 * /api/v1/superadmin/auth/me:
 *   get:
 *     tags: [SuperAdmin]
 *     summary: Get current super admin profile
 */
superAdminRouter.get('/auth/me', authenticateSuperAdmin, superAdminMe);

/**
 * @openapi
 * /api/v1/superadmin/requests:
 *   get:
 *     tags: [SuperAdmin]
 *     summary: List company registration requests
 */
superAdminRouter.get(
  '/requests',
  authenticateSuperAdmin,
  validateRequest(superAdminCompanyRequestsQuerySchema),
  superAdminListCompanyRequests,
);

/**
 * @openapi
 * /api/v1/superadmin/requests/{id}/approve:
 *   post:
 *     tags: [SuperAdmin]
 *     summary: Approve company registration and provision tenant
 */
superAdminRouter.post(
  '/requests/:id/approve',
  authenticateSuperAdmin,
  validateRequest(superAdminApproveCompanyRequestSchema),
  superAdminApproveCompanyRequest,
);

/**
 * @openapi
 * /api/v1/superadmin/requests/{id}/reject:
 *   post:
 *     tags: [SuperAdmin]
 *     summary: Reject company registration request
 */
superAdminRouter.post(
  '/requests/:id/reject',
  authenticateSuperAdmin,
  validateRequest(superAdminRejectCompanyRequestSchema),
  superAdminRejectCompanyRequest,
);

/**
 * @openapi
 * /api/v1/superadmin/tenants:
 *   get:
 *     tags: [SuperAdmin]
 *     summary: List tenants (platform)
 */
superAdminRouter.get('/tenants', authenticateSuperAdmin, validateRequest(superAdminTenantListQuerySchema), superAdminListTenants);

/**
 * @openapi
 * /api/v1/superadmin/tenants/{id}:
 *   get:
 *     tags: [SuperAdmin]
 *     summary: Get tenant details (platform)
 */
superAdminRouter.get(
  '/tenants/:id',
  authenticateSuperAdmin,
  validateRequest(superAdminTenantIdParamSchema),
  superAdminGetTenant,
);

/**
 * @openapi
 * /api/v1/superadmin/tenants/{id}/suspend:
 *   post:
 *     tags: [SuperAdmin]
 *     summary: Suspend tenant
 */
superAdminRouter.post(
  '/tenants/:id/suspend',
  authenticateSuperAdmin,
  validateRequest(superAdminSuspendTenantSchema),
  superAdminSuspendTenant,
);

/**
 * @openapi
 * /api/v1/superadmin/tenants/{id}/activate:
 *   post:
 *     tags: [SuperAdmin]
 *     summary: Activate tenant
 */
superAdminRouter.post(
  '/tenants/:id/activate',
  authenticateSuperAdmin,
  validateRequest(superAdminTenantIdParamSchema),
  superAdminActivateTenant,
);

/**
 * @openapi
 * /api/v1/superadmin/analytics:
 *   get:
 *     tags: [SuperAdmin]
 *     summary: Platform analytics summary
 */
superAdminRouter.get('/analytics', authenticateSuperAdmin, superAdminPlatformAnalytics);

export default superAdminRouter;
