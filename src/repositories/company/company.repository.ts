import { Company } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { CreateCompanyInput, UpdateCompanyInput } from '../../types/company/company.types';

export const companyRepository = {
  async createForTenant(tenantId: string, data: CreateCompanyInput): Promise<Company> {
    const company = await prisma.company.create({
      data: { ...data, companyAddress: data.companyAddress },
    });
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { companyId: company.id },
    });
    return company;
  },

  async findByTenantId(tenantId: string): Promise<Company | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { company: true },
    });
    return tenant?.company ?? null;
  },

  async updateByTenantId(tenantId: string, data: UpdateCompanyInput): Promise<Company> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { companyId: true },
    });
    if (!tenant?.companyId) {
      throw new Error('Company not found for tenant');
    }
    return prisma.company.update({
      where: { id: tenant.companyId },
      data,
    });
  },
};
