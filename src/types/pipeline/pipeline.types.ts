

export type CreatePipelineInput = {
  tenantId: string;
  jobId: string;
  candidateId: string;
};

export type UpdatePipelineInput = {
  decisionNote?: string;
  slaDeadline?: Date;
};

export type PipelineListFilters = {
  jobId?: string;
  candidateId?: string;
  stage?: string;
};
