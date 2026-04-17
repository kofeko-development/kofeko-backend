import { Company } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { CreateCompanyInput, UpdateCompanyInput } from '../../types/company/company.types';

export const companyRepository = {
  async create(data: CreateCompanyInput): Promise<Company> {
    return prisma.company.create({
      data: {
        ...data,
        companyAddress: data.companyAddress,
      },
    });
  },

  async findById(id: string): Promise<Company | null> {
    return prisma.company.findUnique({ where: { id } });
  },

  async updateById(id: string, data: UpdateCompanyInput): Promise<Company> {
    return prisma.company.update({
      where: { id },
      data,
    });
  },
};
