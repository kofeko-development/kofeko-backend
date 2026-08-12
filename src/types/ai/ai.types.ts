export type SkillWeight = {
  skill: string;
  weight: number; // 0–10, higher = more important
  yearsOfExperience?: number;
};

export type InterviewRecommendationClassification =
  | 'high_priority_interview'
  | 'interview'
  | 'review'
  | 'low_match';

export type AnalyzeResult = {
  parsedResume: {
    skillsAndTechnologies: string[];
    experience: Array<{
      company?: string;
      title?: string;
      dates?: string;
      highlights?: string[];
    }>;
    education: Array<{
      institution?: string;
      degree?: string;
      field?: string;
      dates?: string;
    }>;
    projects: Array<{
      name?: string;
      description?: string;
      technologies?: string[];
    }>;
    certifications: string[];
  };
  scores: {
    overall: number;
    capabilityFit: number;
    experienceScopeFit: number;
    explicitRequirementFit: number;
    explicitRequirementsApplicable: boolean;
    evidenceConfidence: 'high' | 'medium' | 'low';
    capabilityMatches: Array<{
      capability: string;
      weight: number;
      score: number;
      evidenceLevel: 'demonstrated' | 'supporting' | 'self_declared' | 'no_evidence';
      confidence: 'high' | 'medium' | 'low';
      evidence: string[];
      rationale: string;
    }>;
    requirementMatches: Array<{
      requirement: string;
      status: 'met' | 'partially_evidenced' | 'not_evidenced' | 'does_not_meet';
      evidenceScore: number;
      confidence: 'high' | 'medium' | 'low';
      evidence: string[];
      reasoning: string;
    }>;
    scoreRationale: string;
  };
  hiringIntelligence: {
    candidateSnapshot: string;
    roleFitSummary: string;
    whyRankedHere: string[];
    relevantExperience: {
      totalYearsApprox?: string;
      relevantYearsApprox?: string;
      relevantDomains?: string[];
      keyRolesHeld?: string[];
      scopeAndSeniority?: string;
      narrative?: string;
    };
    evidenceGaps: string[];
    verificationFlags: string[];
    interviewRecommendation: {
      classification: InterviewRecommendationClassification;
      reasoning: string;
    };
    interviewFocus: Array<{
      question: string;
      purpose: 'validate_claim' | 'resolve_gap' | 'test_role_critical_judgment';
      capabilityOrRequirement: string;
      whyAsk: string;
    }>;
  };
};

export type JobForEvaluation = {
  title: string;
  description: string;
  skillWeights: SkillWeight[];
  explicitRequirementLines?: string;
};
