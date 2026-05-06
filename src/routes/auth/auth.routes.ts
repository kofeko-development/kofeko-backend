import { Router } from 'express';
import {
  acceptInvite,
  forgotPassword,
  loginCandidate,
  login,
  logout,
  me,
  refreshToken,
  registerAdmin,
  registerCandidate,
  resetPassword,
} from '../../controllers/auth/auth.controller';
import { authenticate } from '../../common/middlewares/authenticate';
import { validateRequest } from '../../common/middlewares/validateRequest';
import {
  acceptInviteSchema,
  forgotPasswordSchema,
  loginCandidateSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerAdminSchema,
  registerCandidateSchema,
  resetPasswordSchema,
} from '../../validations/auth/auth.validation';

const authRouter = Router();

authRouter.post('/register-admin', validateRequest(registerAdminSchema), registerAdmin);
authRouter.post('/login', validateRequest(loginSchema), login);
authRouter.post('/register-candidate', validateRequest(registerCandidateSchema), registerCandidate);
authRouter.post('/login-candidate', validateRequest(loginCandidateSchema), loginCandidate);

authRouter.post('/accept-invite', validateRequest(acceptInviteSchema), acceptInvite);
authRouter.post('/forgot-password', validateRequest(forgotPasswordSchema), forgotPassword);
authRouter.post('/reset-password', validateRequest(resetPasswordSchema), resetPassword);

authRouter.post('/refresh', validateRequest(refreshSchema), refreshToken);
authRouter.get('/me', authenticate, me);
authRouter.post('/logout', validateRequest(logoutSchema), logout);

export default authRouter;
