export type CreateEvaluationInput = {
  tenantId: string;
  jobId: string;
  candidateId: string;
  pipelineId?: string;
  score: number;
  summary?: string;
  whyCard?: string;
  evaluatedBy?: string;
};

export type UpdateEvaluationInput = Partial<Omit<CreateEvaluationInput, 'tenantId' | 'jobId' | 'candidateId'>>;

export type EvaluationInsightPreviewInput = {
  score: number;
  summary?: string;
  candidateName?: string;
  jobTitle?: string;
};
