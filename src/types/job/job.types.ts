import { JobStatus } from '@prisma/client';

export type CreateJobInput = {
  tenantId: string;
  title: string;
  description: string;
  location?: string;
  employmentType?: string;
  status?: JobStatus;
  openings?: number;
};

export type UpdateJobInput = Partial<Omit<CreateJobInput, 'tenantId'>>;
