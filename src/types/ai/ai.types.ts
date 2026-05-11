export type SkillWeight = {
  skill: string;
  weight: number; // 0–10, higher = more important
};

export type SectionScores = {
  education: number;
  experience: number;
  skills: number;
  projects: number;
  professionalSummary: number;
  hobbies: number;
};

export type SkillMatchRow = {
  skill: string;
  weight: number;
  matched: boolean;
  contribution: number;
  evidence?: string;
};

export type CareerTrajectoryClassification =
  | 'high_growth'
  | 'steady_progression'
  | 'lateral_movement'
  | 'potential_stagnation';

export type InterviewRecommendationClassification =
  | 'strong_interview'
  | 'possible_interview'
  | 'low_priority'
  | 'reject';

export type ScoreDeduction = {
  factor: string;
  pointsDeductedApprox: number;
  reason: string;
};

export type HiringIntelligence = {
  applicationSummary: string;
  candidateSummary: string;
  keySkills: string[];
  experienceSummary: {
    totalYearsApprox?: string;
    relevantDomains?: string[];
    notableCompaniesOrIndustries?: string[];
    keyRolesHeld?: string[];
    narrative?: string;
  };
  careerTrajectory: {
    classification: CareerTrajectoryClassification;
    explanation: string;
  };
  relevanceToRole: {
    matchScorePercent: number;
    strongMatchAreas: string[];
    missingCapabilities: string[];
  };
  matchScoreBreakdown: {
    theoreticalPerfectScoreNote: string;
    deductions: ScoreDeduction[];
    whyFinalPercentIsNot100: string;
  };
  keyStrengths: string[];
  areasForGrowth: string[];
  riskFlags: string[];
  interviewRecommendation: {
    classification: InterviewRecommendationClassification;
    reasoning: string;
  };
  suggestedInterviewQuestions: string[];
};

export type AnalyzeResult = {
  parsedResume: {
    summary: string;
    skills: string[];
    experience: Array<{ company?: string; title?: string; dates?: string; highlights?: string[] }>;
    education: Array<{ institution?: string; degree?: string; field?: string; dates?: string }>;
    projects: Array<{ name?: string; description?: string; technologies?: string[] }>;
    hobbies: string[];
  };
  scores: {
    overall: number;
    sections: SectionScores;
    skillMatches: SkillMatchRow[];
    roleFitNotes: string;
  };
  rankingSummary: string;
  hiringIntelligence: HiringIntelligence;
};

export type JobForEvaluation = {
  title: string;
  description: string;
  skillWeights: SkillWeight[];
};
