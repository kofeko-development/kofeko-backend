import { CandidateStatus } from '@prisma/client';

export type CreateCandidateInput = {
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  resumeUrl: string;
  resumeMimeType?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  expectedSalary?: number;
  noticePeriod?: number;
  skills?: string[];
  location?: string;
  source?: string;
  currentCompany?: string;
  yearsOfExperience?: number;
  status?: CandidateStatus;
};

export type UpdateCandidateInput = Partial<Omit<CreateCandidateInput, 'tenantId' | 'email'>>;
