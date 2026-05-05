import { Company } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { companyRepository } from '../../repositories/company/company.repository';
import { CreateCompanyInput, UpdateCompanyInput } from '../../types/company/company.types';

export const companyService = {
  async createCompany(tenantId: string, payload: CreateCompanyInput): Promise<Company> {
    return companyRepository.createForTenant(tenantId, payload);
  },

  async getCompanyByTenantId(tenantId: string): Promise<Company> {
    const company = await companyRepository.findByTenantId(tenantId);

    if (!company) {
      throw new AppError('Company not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return company;
  },

  async updateCompanyByTenantId(tenantId: string, payload: UpdateCompanyInput): Promise<Company> {
    await this.getCompanyByTenantId(tenantId);
    return companyRepository.updateByTenantId(tenantId, payload);
  },
};
