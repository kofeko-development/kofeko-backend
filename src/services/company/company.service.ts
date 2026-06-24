import { Company } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { companyRepository } from '../../repositories/company/company.repository';
import { CreateCompanyInput, UpdateCompanyInput } from '../../types/company/company.types';
import { auditService } from '../audit/audit.service';
import { cacheService, cacheKeys } from '../../common/cache/cacheService';
import { env } from '../../config/env';

type CompanyProfile = {
  tenant: { id: string; name: string; slug: string };
  company: Company;
};

export const companyService = {
  async createCompany(tenantId: string, payload: CreateCompanyInput, actorId?: string): Promise<CompanyProfile> {
    const company = await companyRepository.createForTenant(tenantId, payload);
    await auditService.createAuditLog({
      tenantId,
      actorId,
      action: 'create',
      entityType: 'Company',
      entityId: company.id,
      metadata: { companyName: company.companyName },
    });
    await cacheService.invalidateCompany(tenantId);
    return this.getCompanyProfileByTenantId(tenantId);
  },

  async getCompanyByTenantId(tenantId: string): Promise<Company> {
    const company = await companyRepository.findByTenantId(tenantId);

    if (!company) {
      throw new AppError('Company not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return company;
  },

  async getCompanyProfileByTenantId(
    tenantId: string,
  ): Promise<CompanyProfile> {
    const cacheKey = cacheKeys.companyProfile(tenantId);
    return cacheService.getOrSet(cacheKey, env.CACHE_TTL_SECONDS, async () => {
      const result = await companyRepository.findCompanyWithTenantInfo(tenantId);
      if (!result) {
        throw new AppError('Company not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
      }
      return result;
    });
  },

  async updateCompanyByTenantId(
    tenantId: string,
    payload: UpdateCompanyInput,
    actorId?: string,
  ): Promise<CompanyProfile> {
    const before = await this.getCompanyByTenantId(tenantId);
    const company = await companyRepository.updateByTenantId(tenantId, payload);
    await auditService.createAuditLog({
      tenantId,
      actorId,
      action: 'update',
      entityType: 'Company',
      entityId: company.id,
      metadata: { before, after: company },
    });
    await cacheService.invalidateCompany(tenantId);
    return this.getCompanyProfileByTenantId(tenantId);
  },
};
