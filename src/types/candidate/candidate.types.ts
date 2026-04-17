import { CandidateStatus } from '@prisma/client';

export type CreateCandidateInput = {
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  resumeUrl?: string;
  currentCompany?: string;
  yearsOfExperience?: number;
  status?: CandidateStatus;
};

export type UpdateCandidateInput = Partial<Omit<CreateCandidateInput, 'tenantId' | 'email'>>;
