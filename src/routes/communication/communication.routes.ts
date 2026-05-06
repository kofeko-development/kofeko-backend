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
  sendManualMessage,
} from '../../controllers/communication/communication.controller';
import {
  createMessageSchema,
  createNotificationSchema,
  manualSendSchema,
  notificationIdParamSchema,
  tenantQuerySchema,
} from '../../validations/communication/communication.validation';

const communicationRouter = Router();

/**
 * @openapi
 * /api/v1/communication/notifications:
 *   post:
 *     tags: [Communication]
 *     summary: Create notification
 */
communicationRouter.post(
  '/notifications',
  authenticate,
  authorize([PERMISSIONS.COMMUNICATION_CREATE]),
  validateRequest(createNotificationSchema),
  createNotification,
);

/**
 * @openapi
 * /api/v1/communication/notifications:
 *   get:
 *     tags: [Communication]
 *     summary: List notifications
 */
communicationRouter.get(
  '/notifications',
  authenticate,
  authorize([PERMISSIONS.COMMUNICATION_READ]),
  validateRequest(tenantQuerySchema),
  listNotifications,
);

/**
 * @openapi
 * /api/v1/communication/notifications/unread:
 *   get:
 *     tags: [Communication]
 *     summary: List unread notifications
 */
communicationRouter.get(
  '/notifications/unread',
  authenticate,
  authorize([PERMISSIONS.COMMUNICATION_READ]),
  validateRequest(tenantQuerySchema),
  listUnreadNotifications,
);

/**
 * @openapi
 * /api/v1/communication/notifications/{id}/read:
 *   patch:
 *     tags: [Communication]
 *     summary: Mark notification as read
 */
communicationRouter.patch(
  '/notifications/:id/read',
  authenticate,
  authorize([PERMISSIONS.COMMUNICATION_READ]),
  validateRequest(notificationIdParamSchema),
  markNotificationAsRead,
);

/**
 * @openapi
 * /api/v1/communication/messages:
 *   post:
 *     tags: [Communication]
 *     summary: Create message
 */
communicationRouter.post(
  '/messages',
  authenticate,
  authorize([PERMISSIONS.COMMUNICATION_CREATE]),
  validateRequest(createMessageSchema),
  createMessage,
);

/**
 * @openapi
 * /api/v1/communication/messages:
 *   get:
 *     tags: [Communication]
 *     summary: List messages
 */
communicationRouter.get(
  '/messages',
  authenticate,
  authorize([PERMISSIONS.COMMUNICATION_READ]),
  validateRequest(tenantQuerySchema),
  listMessages,
);

/**
 * @openapi
 * /api/v1/communication/send:
 *   post:
 *     tags: [Communication]
 *     summary: Send manual message (email) and persist message/notification records
 */
communicationRouter.post(
  '/send',
  authenticate,
  authorize([PERMISSIONS.COMMUNICATION_CREATE]),
  validateRequest(manualSendSchema),
  sendManualMessage,
);

export default communicationRouter;
