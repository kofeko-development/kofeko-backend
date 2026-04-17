import { Tenant } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { tenantRepository } from '../../repositories/tenant/tenant.repository';
import { CreateTenantInput, UpdateTenantInput } from '../../types/tenant/tenant.types';

export const tenantService = {
  async createTenant(payload: CreateTenantInput): Promise<Tenant> {
    return tenantRepository.create(payload);
  },

  async getTenantById(id: string): Promise<Tenant> {
    const tenant = await tenantRepository.findById(id);

    if (!tenant) {
      throw new AppError('Tenant not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return tenant;
  },

  async updateTenant(id: string, payload: UpdateTenantInput): Promise<Tenant> {
    await this.getTenantById(id);
    return tenantRepository.updateById(id, payload);
  },
};
