import { Company } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { companyRepository } from '../../repositories/company/company.repository';
import { CreateCompanyInput, UpdateCompanyInput } from '../../types/company/company.types';

export const companyService = {
  async createCompany(payload: CreateCompanyInput): Promise<Company> {
    return companyRepository.create(payload);
  },

  async getCompanyById(id: string): Promise<Company> {
    const company = await companyRepository.findById(id);

    if (!company) {
      throw new AppError('Company not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return company;
  },

  async updateCompany(id: string, payload: UpdateCompanyInput): Promise<Company> {
    await this.getCompanyById(id);
    return companyRepository.updateById(id, payload);
  },
};
