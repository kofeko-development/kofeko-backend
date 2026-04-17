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

userRouter.post(
  '/',
  authenticate,
  authorize([PERMISSIONS.USER_CREATE]),
  validateRequest(createUserSchema),
  createUser,
);
userRouter.post(
  '/invite',
  authenticate,
  authorize([PERMISSIONS.USER_INVITE]),
  validateRequest(inviteUserSchema),
  inviteUser,
);
userRouter.get(
  '/',
  authenticate,
  authorize([PERMISSIONS.USER_READ]),
  validateRequest(userListQuerySchema),
  listUsers,
);
userRouter.get(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.USER_READ]),
  validateRequest(userIdParamSchema),
  getUser,
);
userRouter.patch(
  '/:id',
  authenticate,
  authorize([PERMISSIONS.USER_UPDATE]),
  validateRequest(updateUserSchema),
  updateUser,
);

export default userRouter;
