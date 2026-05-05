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

  async listByTenant(tenantId: string): Promise<User[]> {
    return prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async updateByIdAndTenant(id: string, tenantId: string, data: UpdateUserInput): Promise<User> {
    const current = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!current) {
      throw new Error('User not found in tenant');
    }
    return prisma.user.update({ where: { id: current.id }, data });
  },
};
