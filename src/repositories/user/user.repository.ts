import { Role, User, UserStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
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

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
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

  async listByTenant(tenantId: string): Promise<User[]> {
    return prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async updateById(id: string, data: UpdateUserInput): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  },
};
