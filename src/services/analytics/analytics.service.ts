import { Metric } from '@prisma/client';
import { analyticsRepository } from '../../repositories/analytics/analytics.repository';
import { CreateMetricInput } from '../../types/analytics/analytics.types';
import { AnalyticsDashboardSummary, AnalyticsSlaSummary } from '../../types/analytics/analytics.summary.types';
import { PaginationInput } from '../../common/utils/pagination';

export const analyticsService = {
  async createMetric(payload: CreateMetricInput): Promise<Metric> {
    return analyticsRepository.createMetric(payload);
  },

  async listMetricsByTenant(tenantId: string, pagination: PaginationInput): Promise<{ items: Metric[]; total: number }> {
    return analyticsRepository.listMetricsByTenant(tenantId, pagination);
  },

  async getSummary(tenantId: string) {
    return analyticsRepository.getTenantSummary(tenantId);
  },

  async getPipelineFunnel(tenantId: string, jobId?: string) {
    return analyticsRepository.getPipelineFunnel(tenantId, jobId);
  },

  async getTimeToDecision(tenantId: string, jobId?: string) {
    return analyticsRepository.getTimeToDecision(tenantId, jobId);
  },

  async getScoreDistribution(tenantId: string, jobId?: string) {
    return analyticsRepository.getEvaluationScoreDistribution(tenantId, jobId);
  },

  async getRecentActivity(tenantId: string, limit: number) {
    return analyticsRepository.getRecentActivity(tenantId, limit);
  },

  async getHiringVelocity(tenantId: string, jobId?: string) {
    return analyticsRepository.getHiringVelocity(tenantId, jobId);
  },

  async getDashboardSummary(tenantId: string): Promise<AnalyticsDashboardSummary> {
    return analyticsRepository.getDashboardSummary(tenantId);
  },

  async getSlaSummary(tenantId: string): Promise<AnalyticsSlaSummary> {
    return analyticsRepository.getSlaSummary(tenantId);
  },
};
