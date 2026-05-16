import { Router } from 'express';
import {
  acceptInvite,
  forgotPassword,
  loginCandidate,
  loginCandidateWithGoogle,
  loginCandidateWithSupabase,
  login,
  logout,
  me,
  refreshToken,
  registerAdmin,
  registerCompanyRequest,
  registerCandidate,
  resetPassword,
  sendCompanySignupEmailOtp,
  verifyCompanySignupEmailOtp,
  verifyCandidatePhoneOtpMsg91,
  sendCandidateSignupEmailOtp,
  verifyCandidateSignupEmailOtp,
  uploadPublicLogo,
} from '../../controllers/auth/auth.controller';
import { authenticate } from '../../common/middlewares/authenticate';
import { validateRequest } from '../../common/middlewares/validateRequest';
import {
  acceptInviteSchema,
  forgotPasswordSchema,
  loginCandidateSchema,
  loginCandidateGoogleSchema,
  loginCandidateSupabaseSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerAdminSchema,
  registerCompanyRequestSchema,
  registerCandidateSchema,
  resetPasswordSchema,
  sendCompanySignupEmailOtpSchema,
  verifyCompanySignupEmailOtpSchema,
  verifyCandidatePhoneOtpMsg91Schema,
  sendCandidateSignupEmailOtpSchema,
  verifyCandidateSignupEmailOtpSchema,
} from '../../validations/auth/auth.validation';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const authRouter = Router();

/**
 * @openapi
 * /api/v1/auth/upload-logo:
 *   post:
 *     tags: [Auth]
 *     summary: Upload company logo (Public, for signup)
 */
authRouter.post('/upload-logo', upload.single('logo'), uploadPublicLogo);

/**
 * @openapi
 * /api/v1/auth/register-admin:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new company + first staff admin
 *     security: []
 */
authRouter.post('/register-admin', validateRequest(registerAdminSchema), registerAdmin);

/**
 * @openapi
 * /api/v1/auth/register-company-email-otp/send:
 *   post:
 *     tags: [Auth]
 *     summary: Send a 6-digit OTP to the company admin email (company signup)
 *     security: []
 */
authRouter.post(
  '/register-company-email-otp/send',
  validateRequest(sendCompanySignupEmailOtpSchema),
  sendCompanySignupEmailOtp,
);

/**
 * @openapi
 * /api/v1/auth/register-company-email-otp/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Verify company signup email OTP and return a short-lived token for registration submit
 *     security: []
 */
authRouter.post(
  '/register-company-email-otp/verify',
  validateRequest(verifyCompanySignupEmailOtpSchema),
  verifyCompanySignupEmailOtp,
);

authRouter.post(
  '/candidate-phone-otp/verify-msg91',
  validateRequest(verifyCandidatePhoneOtpMsg91Schema),
  verifyCandidatePhoneOtpMsg91,
);

authRouter.post(
  '/candidate-signup-email-otp/send',
  validateRequest(sendCandidateSignupEmailOtpSchema),
  sendCandidateSignupEmailOtp,
);

authRouter.post(
  '/candidate-signup-email-otp/verify',
  validateRequest(verifyCandidateSignupEmailOtpSchema),
  verifyCandidateSignupEmailOtp,
);

/**
 * @openapi
 * /api/v1/auth/register-company-request:
 *   post:
 *     tags: [Auth]
 *     summary: Submit company registration request (awaits Super Admin approval)
 *     security: []
 */
authRouter.post('/register-company-request', validateRequest(registerCompanyRequestSchema), registerCompanyRequest);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Staff login with tenantSlug + email + password
 *     security: []
 */
authRouter.post('/login', validateRequest(loginSchema), login);

/**
 * @openapi
 * /api/v1/auth/register-candidate:
 *   post:
 *     tags: [Auth]
 *     summary: Register a candidate account (internal auth module)
 *     security: []
 */
authRouter.post('/register-candidate', validateRequest(registerCandidateSchema), registerCandidate);

/**
 * @openapi
 * /api/v1/auth/login-candidate:
 *   post:
 *     tags: [Auth]
 *     summary: Candidate login (internal auth module)
 *     security: []
 */
authRouter.post('/login-candidate', validateRequest(loginCandidateSchema), loginCandidate);

/**
 * @openapi
 * /api/v1/auth/login-candidate-google:
 *   post:
 *     tags: [Auth]
 *     summary: Candidate login/signup with Google (Firebase)
 *     security: []
 */
authRouter.post('/login-candidate-google', validateRequest(loginCandidateGoogleSchema), loginCandidateWithGoogle);

/**
 * @openapi
 * /api/v1/auth/login-candidate-supabase:
 *   post:
 *     tags: [Auth]
 *     summary: Candidate login/signup with Supabase Auth (email/password)
 *     security: []
 */
authRouter.post('/login-candidate-supabase', validateRequest(loginCandidateSupabaseSchema), loginCandidateWithSupabase);

/**
 * @openapi
 * /api/v1/auth/accept-invite:
 *   post:
 *     tags: [Auth]
 *     summary: Accept invite and set password for a staff user
 *     security: []
 */
authRouter.post('/accept-invite', validateRequest(acceptInviteSchema), acceptInvite);

/**
 * @openapi
 * /api/v1/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Send password reset email (staff)
 *     security: []
 */
authRouter.post('/forgot-password', validateRequest(forgotPasswordSchema), forgotPassword);

/**
 * @openapi
 * /api/v1/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using reset token (staff)
 *     security: []
 */
authRouter.post('/reset-password', validateRequest(resetPasswordSchema), resetPassword);

/**
 * @openapi
 * /api/v1/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh staff access token
 *     security: []
 */
authRouter.post('/refresh', validateRequest(refreshSchema), refreshToken);

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current staff user profile
 */
authRouter.get('/me', authenticate, me);

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout staff session (revoke refresh token)
 *     security: []
 */
authRouter.post('/logout', validateRequest(logoutSchema), logout);

export default authRouter;
