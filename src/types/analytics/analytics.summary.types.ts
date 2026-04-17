export type AnalyticsSlaSummary = {
  recruiter: {
    averageShortlistTurnaroundHours: number;
    sampleSize: number;
    overdueCount: number;
    overdueThresholdHours: number;
  };
  hiringManager: {
    averageFeedbackTurnaroundHours: number;
    sampleSize: number;
    overdueCount: number;
    overdueThresholdHours: number;
  };
  bottlenecks: {
    recruiterShortlistDelay: number;
    interviewFeedbackDelay: number;
  };
};

export type AnalyticsDashboardSummary = {
  jobs: {
    total: number;
    open: number;
    draft: number;
    paused: number;
    closed: number;
  };
  candidates: {
    total: number;
    new: number;
    screened: number;
    shortlisted: number;
    rejected: number;
    hired: number;
  };
  pipelines: {
    total: number;
  };
  evaluations: {
    total: number;
    averageScore: number;
  };
  metrics: {
    total: number;
  };
  sla: AnalyticsSlaSummary;
};
