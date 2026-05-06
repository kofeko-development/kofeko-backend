import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import { createAuditLog, getAuditLog, listAuditLogs } from '../../controllers/audit/audit.controller';
import {
  auditTenantQuerySchema,
  auditIdParamSchema,
  createAuditLogSchema,
} from '../../validations/audit/audit.validation';

const auditRouter = Router();

/**
 * @openapi
 * /api/v1/audit/logs:
 *   post:
 *     tags: [Audit]
 *     summary: Create audit log (internal)
 */
auditRouter.post(
  '/logs',
  authenticate,
  authorize([PERMISSIONS.AUDIT_CREATE]),
  validateRequest(createAuditLogSchema),
  createAuditLog,
);

/**
 * @openapi
 * /api/v1/audit/logs:
 *   get:
 *     tags: [Audit]
 *     summary: List audit logs with filters and pagination
 */
auditRouter.get(
  '/logs',
  authenticate,
  authorize([PERMISSIONS.AUDIT_READ]),
  validateRequest(auditTenantQuerySchema),
  listAuditLogs,
);

/**
 * @openapi
 * /api/v1/audit/logs/{id}:
 *   get:
 *     tags: [Audit]
 *     summary: Get audit log by id
 */
auditRouter.get(
  '/logs/:id',
  authenticate,
  authorize([PERMISSIONS.AUDIT_READ]),
  validateRequest(auditIdParamSchema),
  getAuditLog,
);

export default auditRouter;
