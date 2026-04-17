import { Tenant } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { CreateTenantInput, UpdateTenantInput } from '../../types/tenant/tenant.types';

export const tenantRepository = {
  async create(data: CreateTenantInput): Promise<Tenant> {
    return prisma.tenant.create({ data });
  },

  async findById(id: string): Promise<Tenant | null> {
    return prisma.tenant.findUnique({ where: { id } });
  },

  async updateById(id: string, data: UpdateTenantInput): Promise<Tenant> {
    return prisma.tenant.update({
      where: { id },
      data,
    });
  },
};
