import { Metric } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { PaginationInput } from '../../common/utils/pagination';
import { CreateMetricInput } from '../../types/analytics/analytics.types';
import { AnalyticsDashboardSummary, AnalyticsSlaSummary } from '../../types/analytics/analytics.summary.types';

const RECRUITER_SHORTLIST_SLA_HOURS = 48;
const HIRING_MANAGER_FEEDBACK_SLA_HOURS = 24;

const getAverage = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, current) => sum + current, 0) / values.length;
};

const hoursBetween = (startDate: Date, endDate: Date): number => {
  return Math.max(0, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
};

const extractStage = (metadata: unknown, key: 'before' | 'after'): string | null => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const layer = (metadata as Record<string, unknown>)[key];

  if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
    return null;
  }

  const stage = (layer as Record<string, unknown>).stage;
  return typeof stage === 'string' ? stage : null;
};

const extractStringField = (metadata: unknown, fieldName: string): string | null => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[fieldName];
  return typeof value === 'string' ? value : null;
};

const buildSlaSummary = async (tenantId: string): Promise<AnalyticsSlaSummary> => {
  const [candidateRows, pipelineRows, interviewStageAuditRows, evaluationAuditRows] = await Promise.all([
    prisma.candidate.findMany({
      where: { tenantId },
      select: { id: true, createdAt: true },
    }),
    prisma.pipeline.findMany({
      where: { tenantId },
      select: { id: true, candidateId: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: {
        tenantId,
        entityType: 'Pipeline',
        action: 'update',
      },
      select: {
        createdAt: true,
        entityId: true,
        metadata: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.auditLog.findMany({
      where: {
        tenantId,
        entityType: 'Evaluation',
        action: 'evaluate',
      },
      select: {
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const firstPipelineByCandidate = new Map<string, Date>();

  for (const pipeline of pipelineRows) {
    const currentFirst = firstPipelineByCandidate.get(pipeline.candidateId);
    if (!currentFirst || pipeline.createdAt < currentFirst) {
      firstPipelineByCandidate.set(pipeline.candidateId, pipeline.createdAt);
    }
  }

  const shortlistTurnaroundHours = candidateRows
    .map((candidate) => {
      const firstPipelineAt = firstPipelineByCandidate.get(candidate.id);
      if (!firstPipelineAt) {
        return null;
      }
      return hoursBetween(candidate.createdAt, firstPipelineAt);
    })
    .filter((value): value is number => value !== null);

  const pipelineInterviewStageAt = new Map<string, Date>();

  for (const row of interviewStageAuditRows) {
    const beforeStage = extractStage(row.metadata, 'before');
    const afterStage = extractStage(row.metadata, 'after');
    if (!afterStage) {
      continue;
    }

    const movedIntoInterview =
      (afterStage === 'technical_interview' || afterStage === 'hr_interview') &&
      beforeStage !== afterStage;

    if (!movedIntoInterview) {
      continue;
    }

    const existing = pipelineInterviewStageAt.get(row.entityId);
    if (!existing || row.createdAt < existing) {
      pipelineInterviewStageAt.set(row.entityId, row.createdAt);
    }
  }

  const firstEvaluationByPipeline = new Map<string, Date>();

  for (const row of evaluationAuditRows) {
    const pipelineId = extractStringField(row.metadata, 'pipelineId');
    if (!pipelineId) {
      continue;
    }

    const existing = firstEvaluationByPipeline.get(pipelineId);
    if (!existing || row.createdAt < existing) {
      firstEvaluationByPipeline.set(pipelineId, row.createdAt);
    }
  }

  const feedbackTurnaroundHours = Array.from(pipelineInterviewStageAt.entries())
    .map(([pipelineId, interviewAt]) => {
      const firstFeedbackAt = firstEvaluationByPipeline.get(pipelineId);
      if (!firstFeedbackAt) {
        return null;
      }
      return hoursBetween(interviewAt, firstFeedbackAt);
    })
    .filter((value): value is number => value !== null);

  const recruiterOverdueCount = shortlistTurnaroundHours.filter(
    (hours) => hours > RECRUITER_SHORTLIST_SLA_HOURS,
  ).length;

  const feedbackOverdueCount = feedbackTurnaroundHours.filter(
    (hours) => hours > HIRING_MANAGER_FEEDBACK_SLA_HOURS,
  ).length;

  return {
    recruiter: {
      averageShortlistTurnaroundHours: getAverage(shortlistTurnaroundHours),
      sampleSize: shortlistTurnaroundHours.length,
      overdueCount: recruiterOverdueCount,
      overdueThresholdHours: RECRUITER_SHORTLIST_SLA_HOURS,
    },
    hiringManager: {
      averageFeedbackTurnaroundHours: getAverage(feedbackTurnaroundHours),
      sampleSize: feedbackTurnaroundHours.length,
      overdueCount: feedbackOverdueCount,
      overdueThresholdHours: HIRING_MANAGER_FEEDBACK_SLA_HOURS,
    },
    bottlenecks: {
      recruiterShortlistDelay: recruiterOverdueCount,
      interviewFeedbackDelay: feedbackOverdueCount,
    },
  };
};

export const analyticsRepository = {
  async createMetric(data: CreateMetricInput): Promise<Metric> {
    return prisma.metric.create({ data });
  },

  async listMetricsByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: Metric[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.metric.findMany({
        where: { tenantId },
        orderBy: { recordedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.metric.count({ where: { tenantId } }),
    ]);

    return { items, total };
  },

  async getDashboardSummary(tenantId: string): Promise<AnalyticsDashboardSummary> {
    const [jobs, candidates, pipelines, evaluations, metrics, slaSummary] = await Promise.all([
      prisma.job.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { status: true },
      }),
      prisma.candidate.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { status: true },
      }),
      prisma.pipeline.count({ where: { tenantId } }),
      prisma.evaluation.aggregate({
        where: { tenantId },
        _count: { id: true },
        _avg: { score: true },
      }),
      prisma.metric.count({ where: { tenantId } }),
      buildSlaSummary(tenantId),
    ]);

    const jobSummary = {
      total: jobs.reduce((total, item) => total + item._count.status, 0),
      open: jobs.find((item) => item.status === 'open')?._count.status ?? 0,
      draft: jobs.find((item) => item.status === 'draft')?._count.status ?? 0,
      paused: jobs.find((item) => item.status === 'paused')?._count.status ?? 0,
      closed: jobs.find((item) => item.status === 'closed')?._count.status ?? 0,
    };

    const candidateSummary = {
      total: candidates.reduce((total, item) => total + item._count.status, 0),
      new: candidates.find((item) => item.status === 'new')?._count.status ?? 0,
      screened: candidates.find((item) => item.status === 'screened')?._count.status ?? 0,
      shortlisted: candidates.find((item) => item.status === 'shortlisted')?._count.status ?? 0,
      rejected: candidates.find((item) => item.status === 'rejected')?._count.status ?? 0,
      hired: candidates.find((item) => item.status === 'hired')?._count.status ?? 0,
    };

    return {
      jobs: jobSummary,
      candidates: candidateSummary,
      pipelines: {
        total: pipelines,
      },
      evaluations: {
        total: evaluations._count.id,
        averageScore: evaluations._avg.score ?? 0,
      },
      metrics: {
        total: metrics,
      },
      sla: slaSummary,
    };
  },

  async getSlaSummary(tenantId: string): Promise<AnalyticsSlaSummary> {
    return buildSlaSummary(tenantId);
  },
};
