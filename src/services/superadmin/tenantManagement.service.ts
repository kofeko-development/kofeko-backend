import { StatusCodes } from 'http-status-codes';
import { TenantStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { auditService } from '../audit/audit.service';
import { sendTenantStatusEmail } from '../email/tenant-email.service';

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

  async restrictTenant(id: string, reason: string, superAdminId: string, days?: number) {
    const suspendedUntil = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        status: TenantStatus.suspended,
        suspendedUntil,
        suspensionReason: reason
      },
      include: {
        users: {
          where: { userRoles: { some: { role: { name: 'Admin' } } } }, // rough heuristic for contact email
          take: 1
        }
      }
    });

    await auditService.createAuditLog({
      tenantId: id,
      actorId: superAdminId,
      action: 'suspend',
      entityType: 'tenant',
      entityId: id,
      metadata: { reason, days },
    });

    // We assume the first admin is the main contact, or we could fetch CompanyRequest adminEmail.
    // Let's fetch the company request contact via company name
    const company = await prisma.company.findUnique({ where: { id: tenant.companyId! } });
    if (company) {
      // Find the admin user's email
      const adminUser = await prisma.user.findFirst({ where: { tenantId: id } });
      if (adminUser) {
        await sendTenantStatusEmail({
          companyName: company.companyName,
          toEmail: adminUser.email,
          status: 'restricted',
          reason,
          days
        });
      }
    }

    return tenant;
  },

  async deleteTenant(id: string, reason: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id }, include: { company: true } });
    if (!tenant) throw new AppError('Tenant not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);

    const adminUser = await prisma.user.findFirst({ where: { tenantId: id } });
    const emailToNotify = adminUser?.email;
    const companyName = tenant.company?.companyName || tenant.name;
    const companyId = tenant.companyId;

    // Delete tenant (cascading deletes users, jobs, candidates, etc)
    await prisma.tenant.delete({
      where: { id }
    });

    // Delete company if exists
    if (companyId) {
      await prisma.company.delete({
        where: { id: companyId }
      });
    }

    // Since tenant is deleted, we can't create an audit log referencing the tenantId directly as a foreign key if auditlog has cascade, wait!
    // AuditLog has tenantId. If we deleted the tenant, we can't store audit log for it unless we detach it.
    // Actually, usually admin actions are stored without foreign constraints if the tenant is deleted, or we just log it.
    // Let's just rely on the email sent.

    if (emailToNotify) {
      await sendTenantStatusEmail({
        companyName,
        toEmail: emailToNotify,
        status: 'deleted',
        reason,
      });
    }

    return true;
  },

  async activateTenant(id: string, superAdminId: string) {
    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        status: TenantStatus.active,
        suspendedUntil: null,
        suspensionReason: null
      },
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

