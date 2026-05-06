import { AuditLog, Metric, User } from '@prisma/client';
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

  async getTenantSummary(tenantId: string): Promise<{
    totalJobs: number;
    openJobs: number;
    totalCandidates: number;
    newCandidates: number;
    screeningCandidates: number;
    hiredCandidates: number;
    rejectedCandidates: number;
    totalPipelines: number;
    activePipelines: number;
    totalEvaluations: number;
    aiEvaluations: number;
    activeUsers: number;
  }> {
    const [
      totalJobs,
      openJobs,
      totalCandidates,
      newCandidates,
      screeningCandidates,
      hiredCandidates,
      rejectedCandidates,
      totalPipelines,
      activePipelines,
      totalEvaluations,
      aiEvaluations,
      activeUsers,
    ] = await Promise.all([
      prisma.job.count({ where: { tenantId } }),
      prisma.job.count({ where: { tenantId, status: 'open' } }),
      prisma.candidate.count({ where: { tenantId } }),
      prisma.candidate.count({ where: { tenantId, status: 'new' } }),
      prisma.candidate.count({ where: { tenantId, status: 'screening' } }),
      prisma.candidate.count({ where: { tenantId, status: 'hired' } }),
      prisma.candidate.count({ where: { tenantId, status: 'rejected' } }),
      prisma.pipeline.count({ where: { tenantId } }),
      prisma.pipeline.count({ where: { tenantId, stage: { notIn: ['hired', 'rejected'] } } }),
      prisma.evaluation.count({ where: { tenantId } }),
      prisma.evaluation.count({ where: { tenantId, aiGenerated: true } }),
      prisma.user.count({ where: { tenantId, status: 'active' } }),
    ]);

    return {
      totalJobs,
      openJobs,
      totalCandidates,
      newCandidates,
      screeningCandidates,
      hiredCandidates,
      rejectedCandidates,
      totalPipelines,
      activePipelines,
      totalEvaluations,
      aiEvaluations,
      activeUsers,
    };
  },

  async getPipelineFunnel(
    tenantId: string,
    jobId?: string,
  ): Promise<{
    applied: number;
    screening: number;
    technical_interview: number;
    hr_interview: number;
    offer: number;
    hired: number;
    rejected: number;
  }> {
    const rows = await prisma.pipeline.groupBy({
      by: ['stage'],
      where: {
        tenantId,
        ...(jobId ? { jobId } : {}),
      },
      _count: { stage: true },
    });

    const result = {
      applied: 0,
      screening: 0,
      technical_interview: 0,
      hr_interview: 0,
      offer: 0,
      hired: 0,
      rejected: 0,
    };

    for (const row of rows) {
      const stage = row.stage as keyof typeof result;
      if (stage in result) {
        result[stage] = row._count.stage;
      }
    }

    return result;
  },

  async getTimeToDecision(tenantId: string, jobId?: string): Promise<number | null> {
    const completed = await prisma.pipeline.findMany({
      where: {
        tenantId,
        ...(jobId ? { jobId } : {}),
        stage: { in: ['hired', 'rejected'] },
      },
      select: { createdAt: true, updatedAt: true },
    });

    if (completed.length === 0) {
      return null;
    }

    const dayMs = 1000 * 60 * 60 * 24;
    const days = completed.map((p) => Math.max(0, (p.updatedAt.getTime() - p.createdAt.getTime()) / dayMs));
    const avg = days.reduce((sum, v) => sum + v, 0) / days.length;
    return Math.round(avg * 10) / 10;
  },

  async getEvaluationScoreDistribution(
    tenantId: string,
    jobId?: string,
  ): Promise<{ '0-49': number; '50-69': number; '70-84': number; '85-100': number }> {
    const rows = await prisma.evaluation.findMany({
      where: {
        tenantId,
        aiGenerated: true,
        ...(jobId ? { jobId } : {}),
      },
      select: { score: true },
    });

    const buckets = { '0-49': 0, '50-69': 0, '70-84': 0, '85-100': 0 };
    for (const row of rows) {
      const score = Number(row.score) || 0;
      if (score < 50) buckets['0-49'] += 1;
      else if (score < 70) buckets['50-69'] += 1;
      else if (score < 85) buckets['70-84'] += 1;
      else buckets['85-100'] += 1;
    }

    return buckets;
  },

  async getRecentActivity(
    tenantId: string,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      actorId: string;
      actorName: string;
      metadata: unknown;
      createdAt: Date;
    }>
  > {
    const capped = Math.min(50, Math.max(1, limit));
    const logs = await prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: capped,
    });

    const actorIds = Array.from(new Set(logs.map((l) => l.actorId).filter((id): id is string => Boolean(id))));
    const users: User[] = actorIds.length
      ? await prisma.user.findMany({ where: { tenantId, id: { in: actorIds } } })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    return logs.map((l: AuditLog) => {
      const actorId = l.actorId ?? '';
      const user = actorId ? byId.get(actorId) : undefined;
      const actorName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown';
      return {
        id: l.id,
        action: String(l.action),
        entityType: l.entityType,
        entityId: l.entityId,
        actorId,
        actorName,
        metadata: l.metadata,
        createdAt: l.createdAt,
      };
    });
  },

  async getHiringVelocity(
    tenantId: string,
    jobId?: string,
  ): Promise<Array<{ month: string; hired: number }>> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const hiredPipelines = await prisma.pipeline.findMany({
      where: {
        tenantId,
        ...(jobId ? { jobId } : {}),
        stage: 'hired',
        updatedAt: { gte: start },
      },
      select: { updatedAt: true },
    });

    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const counts = new Map<string, number>();
    for (const row of hiredPipelines) {
      const key = monthKey(row.updatedAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const result: Array<{ month: string; hired: number }> = [];
    for (let i = 0; i < 6; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = monthKey(d);
      result.push({ month: key, hired: counts.get(key) ?? 0 });
    }

    return result;
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
      screening: candidates.find((item) => item.status === 'screening')?._count.status ?? 0,
      interview: candidates.find((item) => item.status === 'interview')?._count.status ?? 0,
      offer: candidates.find((item) => item.status === 'offer')?._count.status ?? 0,
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
