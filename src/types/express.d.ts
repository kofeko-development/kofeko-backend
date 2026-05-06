import { AuthenticatedUser } from './auth/auth.types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      superAdmin?: {
        superAdminId: string;
      };
      candidate?: {
        candidateId: string;
        tenantId: string;
      };
    }
  }
}

export {};
