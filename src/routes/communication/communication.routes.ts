import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  createMessage,
  createNotification,
  listMessages,
  listNotifications,
  listUnreadNotifications,
  markNotificationAsRead,
} from '../../controllers/communication/communication.controller';
import {
  createMessageSchema,
  createNotificationSchema,
  notificationIdParamSchema,
  tenantQuerySchema,
} from '../../validations/communication/communication.validation';

const communicationRouter = Router();

communicationRouter.post(
  '/notifications',
  authenticate,
  authorize([PERMISSIONS.COMMUNICATION_CREATE]),
  validateRequest(createNotificationSchema),
  createNotification,
);
communicationRouter.get(
  '/notifications',
  authenticate,
  authorize([PERMISSIONS.COMMUNICATION_READ]),
  validateRequest(tenantQuerySchema),
  listNotifications,
);
communicationRouter.get(
  '/notifications/unread',
  authenticate,
  authorize([PERMISSIONS.COMMUNICATION_READ]),
  validateRequest(tenantQuerySchema),
  listUnreadNotifications,
);
communicationRouter.patch(
  '/notifications/:id/read',
  authenticate,
  authorize([PERMISSIONS.COMMUNICATION_READ]),
  validateRequest(notificationIdParamSchema),
  markNotificationAsRead,
);
communicationRouter.post(
  '/messages',
  authenticate,
  authorize([PERMISSIONS.COMMUNICATION_CREATE]),
  validateRequest(createMessageSchema),
  createMessage,
);
communicationRouter.get(
  '/messages',
  authenticate,
  authorize([PERMISSIONS.COMMUNICATION_READ]),
  validateRequest(tenantQuerySchema),
  listMessages,
);

export default communicationRouter;
