import type { Prisma } from '@prisma/client';

export type CreateEvaluationInput = {
  tenantId: string;
  jobId: string;
  candidateId: string;
  pipelineId?: string;
  score: number;
  summary?: string;
  whyCard?: string;
  aiGenerated?: boolean;
  rankingSummary?: string;
  roleFitNotes?: string;
  sectionScores?: Prisma.InputJsonValue;
  skillMatches?: Prisma.InputJsonValue;
  parsedResumeData?: Prisma.InputJsonValue;
  hiringIntelligence?: Prisma.InputJsonValue;
  evaluatedBy?: string;
};

export type UpdateEvaluationInput = Partial<Omit<CreateEvaluationInput, 'tenantId' | 'jobId' | 'candidateId'>>;
