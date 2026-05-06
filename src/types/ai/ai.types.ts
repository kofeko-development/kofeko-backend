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
};

export type JobForEvaluation = {
  title: string;
  description: string;
  skillWeights: SkillWeight[];
};

