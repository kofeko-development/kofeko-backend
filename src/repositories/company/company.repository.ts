import { Company } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { prisma } from '../../config/prisma';
import { CreateCompanyInput, UpdateCompanyInput } from '../../types/company/company.types';

export const companyRepository = {
  async createForTenant(tenantId: string, data: CreateCompanyInput): Promise<Company> {
    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, companyId: true },
      });

      if (!tenant) {
        throw new AppError('Tenant not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
      }

      if (tenant.companyId) {
        throw new AppError('Company already exists for tenant', StatusCodes.CONFLICT, ERROR_CODES.CONFLICT);
      }

      const companyAddress: Prisma.InputJsonValue = {
        fullAddress: data.officialCompanyAddress,
      };

      const company = await tx.company.create({
        data: {
          ...data,
          companyAddress,
        },
      });

      await tx.tenant.update({
        where: { id: tenantId },
        data: { companyId: company.id },
      });

      return company;
    });
  },

  async findByTenantId(tenantId: string): Promise<Company | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { company: true },
    });
    return tenant?.company ?? null;
  },

  async findCompanyWithTenantInfo(
    tenantId: string,
  ): Promise<{ tenant: { id: string; name: string; slug: string }; company: Company } | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        company: true,
      },
    });

    if (!tenant?.company) {
      return null;
    }

    return {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      company: tenant.company,
    };
  },

  async updateByTenantId(tenantId: string, data: UpdateCompanyInput): Promise<Company> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { companyId: true },
    });
    if (!tenant?.companyId) {
      throw new AppError('Company not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    let nextCompanyAddress: Prisma.InputJsonValue | undefined;
    if (data.officialCompanyAddress) {
      const current = await prisma.company.findUnique({
        where: { id: tenant.companyId },
        select: { companyAddress: true },
      });

      const currentAddress = current?.companyAddress;
      const base =
        currentAddress && typeof currentAddress === 'object' && !Array.isArray(currentAddress)
          ? (currentAddress as Record<string, unknown>)
          : {};

      nextCompanyAddress = {
        ...base,
        fullAddress: data.officialCompanyAddress,
      };
    }

    return prisma.company.update({
      where: { id: tenant.companyId },
      data: {
        ...data,
        ...(nextCompanyAddress ? { companyAddress: nextCompanyAddress } : {}),
      },
    });
  },
};
