import { Router } from 'express';
import { createUser, getUser, inviteUser, listUsers, updateUser } from '../../controllers/user/user.controller';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  createUserSchema,
  inviteUserSchema,
  userListQuerySchema,
  updateUserSchema,
  userIdParamSchema,
} from '../../validations/user/user.validation';

const userRouter = Router();

/**
 * @openapi
 * /api/v1/users:
 *   post:
 *     tags: [Users]
 *     summary: Create staff user
 */
userRouter.post(
  '/',
  authenticate,
  authorize([PERMISSIONS.USER_CREATE]),
  validateRequest(createUserSchema),
  createUser,
);

/**
 * @openapi
 * /api/v1/users/invite:
 *   post:
 *     tags: [Users]
 *     summary: Invite staff user (email invite link)
 */
userRouter.post(
  '/invite',
  authenticate,
  authorize([PERMISSIONS.USER_INVITE]),
  validateRequest(inviteUserSchema),
  inviteUser,
);

/**
 * @openapi
 * /api/v1/users:
 *   get:
 *     tags: [Users]
 *     summary: List staff users (tenant-scoped)
 */
userRouter.get(
  '/',
  authenticate,
  authorize([PERMISSIONS.USER_READ]),
  validateRequest(userListQuerySchema),
  listUsers,
);

/**
 * @openapi
 * /api/v1/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get staff user by id
 */
userRouter.get(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.USER_READ]),
  validateRequest(userIdParamSchema),
  getUser,
);

/**
 * @openapi
 * /api/v1/users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Update staff user
 */
userRouter.patch(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.USER_UPDATE]),
  validateRequest(updateUserSchema),
  updateUser,
);

export default userRouter;
