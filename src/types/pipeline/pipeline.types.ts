import { PipelineStage } from '@prisma/client';

export type CreatePipelineInput = {
  tenantId: string;
  jobId: string;
  candidateId: string;
  stage?: PipelineStage;
  notes?: string;
};

export type UpdatePipelineInput = Partial<Pick<CreatePipelineInput, 'stage' | 'notes'>>;
