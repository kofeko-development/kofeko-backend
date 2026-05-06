import { StatusCodes } from 'http-status-codes';
import { TenantStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { auditService } from '../audit/audit.service';

export const tenantManagementService = {
  async listTenants(input: { status?: TenantStatus; search?: string; page: number; limit: number }) {
    const skip = (input.page - 1) * input.limit;

    const where = {
      status: input.status,
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' as const } },
              { slug: { contains: input.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: input.limit,
        include: {
          company: {
            select: {
              companyName: true,
              companyLogo: true,
            },
          },
          _count: {
            select: {
              users: true,
            },
          },
        },
      }),
    ]);

    return {
      items: rows,
      total,
      page: input.page,
      limit: input.limit,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    };
  },

  async getTenantById(id: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        company: true,
        _count: {
          select: {
            users: true,
            jobs: true,
            candidates: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return tenant;
  },

  async suspendTenant(id: string, reason: string, superAdminId: string) {
    const tenant = await prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.suspended },
    });

    await auditService.createAuditLog({
      tenantId: id,
      actorId: superAdminId,
      action: 'suspend',
      entityType: 'tenant',
      entityId: id,
      metadata: { reason },
    });

    return tenant;
  },

  async activateTenant(id: string, superAdminId: string) {
    const tenant = await prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.active },
    });

    await auditService.createAuditLog({
      tenantId: id,
      actorId: superAdminId,
      action: 'activate',
      entityType: 'tenant',
      entityId: id,
      metadata: {},
    });

    return tenant;
  },
};

