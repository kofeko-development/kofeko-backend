type EvaluationInsightInput = {
  score: number;
  summary?: string;
  candidateName?: string;
  jobTitle?: string;
};

const getScoreLabel = (score: number): string => {
  if (score >= 85) {
    return 'strong match';
  }

  if (score >= 70) {
    return 'promising fit';
  }

  if (score >= 50) {
    return 'mixed fit';
  }

  return 'high risk fit';
};

export const buildEvaluationWhyCard = (input: EvaluationInsightInput): string => {
  const scoreLabel = getScoreLabel(input.score);
  const candidateLabel = input.candidateName ? `${input.candidateName} ` : 'The candidate ';
  const jobLabel = input.jobTitle ? `for ${input.jobTitle} ` : '';
  const summaryLabel = input.summary?.trim();

  if (summaryLabel) {
    return `${candidateLabel}is a ${scoreLabel} ${jobLabel}based on the evaluation summary: ${summaryLabel}`;
  }

  return `${candidateLabel}is a ${scoreLabel} ${jobLabel}with an evaluation score of ${input.score}.`;
};