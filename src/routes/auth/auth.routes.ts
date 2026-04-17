import { Router } from 'express';
import {
  login,
  logout,
  me,
  refreshToken,
  registerAdmin,
} from '../../controllers/auth/auth.controller';
import { authenticate } from '../../common/middlewares/authenticate';
import { validateRequest } from '../../common/middlewares/validateRequest';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerAdminSchema,
} from '../../validations/auth/auth.validation';

const authRouter = Router();

authRouter.post('/register-admin', validateRequest(registerAdminSchema), registerAdmin);
authRouter.post('/login', validateRequest(loginSchema), login);
authRouter.post('/refresh', validateRequest(refreshSchema), refreshToken);
authRouter.get('/me', authenticate, me);
authRouter.post('/logout', validateRequest(logoutSchema), logout);

export default authRouter;
