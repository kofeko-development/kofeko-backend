import { Role, User, UserStatus } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { UpdateUserInput } from '../../types/user/user.types';

export const userRepository = {
  async createWithRole(data: {
    tenantId: string;
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
    roleId: string;
    status?: UserStatus;
  }): Promise<User> {
    return prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          tenantId: data.tenantId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          passwordHash: data.passwordHash,
          status: data.status,
        },
      });

      await tx.userRole.create({
        data: {
          tenantId: data.tenantId,
          userId: createdUser.id,
          roleId: data.roleId,
        },
      });

      return createdUser;
    });
  },

  async findRoleByTenantAndName(tenantId: string, roleName: string): Promise<Role | null> {
    return prisma.role.findUnique({
      where: {
        tenantId_name: {
          tenantId,
          name: roleName,
        },
      },
    });
  },

  async findByIdAndTenant(id: string, tenantId: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { id, tenantId } });
  },

  async findByTenantAndEmail(tenantId: string, email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email,
        },
      },
    });
  },

  async listByTenant(tenantId: string, input: { page: number; limit: number }): Promise<{ items: User[]; total: number }> {
    const { page, limit } = input;
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where: { tenantId } }),
    ]);

    return { items, total };
  },

  async updateByIdAndTenant(id: string, tenantId: string, data: UpdateUserInput): Promise<User> {
    const current = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return prisma.user.update({ where: { id: current.id }, data });
  },
};
