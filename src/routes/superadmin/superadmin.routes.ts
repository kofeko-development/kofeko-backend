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
  superAdminUpdateProfile,
  superAdminPlatformAnalytics,
  superAdminRefresh,
  superAdminRejectCompanyRequest,
  superAdminSuspendTenant,
  superAdminForgotPassword,
  superAdminResetPassword,
} from '../../controllers/superadmin/superadmin.controller';
import {
  superAdminGetAutoApproveSetting,
  superAdminSetAutoApproveSetting,
} from '../../controllers/superadmin/settings.controller';
import { validateRequest } from '../../common/middlewares/validateRequest';
import {
  superAdminApproveCompanyRequestSchema,
  superAdminBootstrapSchema,
  superAdminCompanyRequestsQuerySchema,
  superAdminLoginSchema,
  superAdminLogoutSchema,
  superAdminRefreshSchema,
  superAdminUpdateProfileSchema,
  superAdminRejectCompanyRequestSchema,
  superAdminSuspendTenantSchema,
  superAdminTenantIdParamSchema,
  superAdminTenantListQuerySchema,
  superAdminForgotPasswordSchema,
  superAdminResetPasswordSchema,
  superAdminTwoFactorCodeSchema,
  superAdminLogin2FAVerifySchema,
} from '../../validations/superadmin/superadmin.validation';
import { authenticateSuperAdmin } from '../../common/middlewares/authenticateSuperAdmin';
import {
  superAdminTwoFactorSetup,
  superAdminTwoFactorVerify,
  superAdminTwoFactorDisable,
  superAdminTwoFactorStatus,
  superAdminLogin2FAVerify,
} from '../../controllers/superadmin/superadmin-2fa.controller';

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

superAdminRouter.post(
  '/auth/forgot-password',
  validateRequest(superAdminForgotPasswordSchema),
  superAdminForgotPassword,
);

superAdminRouter.post(
  '/auth/reset-password',
  validateRequest(superAdminResetPasswordSchema),
  superAdminResetPassword,
);

superAdminRouter.post(
  '/auth/login/2fa-verify',
  validateRequest(superAdminLogin2FAVerifySchema),
  superAdminLogin2FAVerify,
);

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

superAdminRouter.patch(
  '/auth/me',
  authenticateSuperAdmin,
  validateRequest(superAdminUpdateProfileSchema),
  superAdminUpdateProfile,
);

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

superAdminRouter.get('/settings/auto-approve', authenticateSuperAdmin, superAdminGetAutoApproveSetting);
superAdminRouter.post('/settings/auto-approve', authenticateSuperAdmin, superAdminSetAutoApproveSetting);

superAdminRouter.post('/2fa/setup', authenticateSuperAdmin, superAdminTwoFactorSetup);
superAdminRouter.post(
  '/2fa/verify',
  authenticateSuperAdmin,
  validateRequest(superAdminTwoFactorCodeSchema),
  superAdminTwoFactorVerify,
);
superAdminRouter.post(
  '/2fa/disable',
  authenticateSuperAdmin,
  validateRequest(superAdminTwoFactorCodeSchema),
  superAdminTwoFactorDisable,
);
superAdminRouter.get('/2fa/status', authenticateSuperAdmin, superAdminTwoFactorStatus);

export default superAdminRouter;
