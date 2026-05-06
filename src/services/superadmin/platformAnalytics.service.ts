import { prisma } from '../../config/prisma';

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

export const platformAnalyticsService = {
  async getPlatformSummary() {
    const monthStart = startOfMonth(new Date());

    const [
      tenantsTotal,
      tenantsActive,
      tenantsSuspended,
      usersTotal,
      jobsTotal,
      candidatesTotal,
      evaluationsTotal,
      aiEvaluationsThisMonth,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'active' } }),
      prisma.tenant.count({ where: { status: 'suspended' } }),
      prisma.user.count(),
      prisma.job.count(),
      prisma.candidate.count(),
      prisma.evaluation.count(),
      prisma.evaluation.count({
        where: {
          aiGenerated: true,
          createdAt: { gte: monthStart },
        },
      }),
    ]);

    return {
      tenants: {
        total: tenantsTotal,
        active: tenantsActive,
        suspended: tenantsSuspended,
      },
      totals: {
        users: usersTotal,
        jobs: jobsTotal,
        candidates: candidatesTotal,
        evaluations: evaluationsTotal,
      },
      aiEvaluationsThisMonth,
    };
  },
};

