import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import { createAuditLog, listAuditLogs } from '../../controllers/audit/audit.controller';
import {
  auditTenantQuerySchema,
  createAuditLogSchema,
} from '../../validations/audit/audit.validation';

const auditRouter = Router();

auditRouter.post(
  '/logs',
  authenticate,
  authorize([PERMISSIONS.AUDIT_CREATE]),
  validateRequest(createAuditLogSchema),
  createAuditLog,
);
auditRouter.get(
  '/logs',
  authenticate,
  authorize([PERMISSIONS.AUDIT_READ]),
  validateRequest(auditTenantQuerySchema),
  listAuditLogs,
);

export default auditRouter;
