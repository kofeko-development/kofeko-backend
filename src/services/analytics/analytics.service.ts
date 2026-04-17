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

  async getDashboardSummary(tenantId: string): Promise<AnalyticsDashboardSummary> {
    return analyticsRepository.getDashboardSummary(tenantId);
  },

  async getSlaSummary(tenantId: string): Promise<AnalyticsSlaSummary> {
    return analyticsRepository.getSlaSummary(tenantId);
  },
};
