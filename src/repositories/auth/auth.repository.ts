import { InviteToken, PasswordResetToken, Permission, Tenant, User, UserStatus } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { DEFAULT_ROLE_PERMISSION_MATRIX } from '../../common/constants/rolePermissionMatrix';
import { ROLE_NAMES } from '../../common/constants/roles';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';

type BootstrapTenantAdminInput = {
  tenantName: string;
  tenantSlug: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  permissionKeys: string[];
};

type BootstrapCandidateUserInput = {
  tenantSlug: string;
  tenantName: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  permissionKeys: string[];
};

type CompanyRegistrationRequestInput = {
  companyName: string;
  companyAddress: {
    country: string;
    state: string;
    city: string;
    zipCode: string;
    fullAddress: string;
  };
  industry: string;
  companySize: string;
  companyType: 'startup' | 'enterprise' | 'agency' | 'non_profit';
  foundedYear: number;
  companyWebsite: string;
  officialCompanyAddress: string;
  phoneNumber?: string;
  companyLogo: string;
  shortDescription: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  termsAccepted: true;
  contactName: string;
  contactEmail: string;
};

export const authRepository = {
  async bootstrapTenantAdmin(input: BootstrapTenantAdminInput): Promise<{ tenant: Tenant; user: User; permissions: Permission[] }> {
    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.tenantName,
          slug: input.tenantSlug,
        },
      });

      await tx.permission.createMany({
        data: input.permissionKeys.map((key) => ({
          tenantId: tenant.id,
          key,
        })),
      });

      const permissions = await tx.permission.findMany({
        where: { tenantId: tenant.id },
      });

      const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission]));

      const roleByName = new Map<string, string>();

      for (const [roleName, rolePermissions] of Object.entries(DEFAULT_ROLE_PERMISSION_MATRIX)) {
        const role = await tx.role.upsert({
          where: {
            tenantId_name: {
              tenantId: tenant.id,
              name: roleName,
            },
          },
          update: {
            description: `Default ${roleName.replace('_', ' ')} role`,
          },
          create: {
            tenantId: tenant.id,
            name: roleName,
            description: `Default ${roleName.replace('_', ' ')} role`,
          },
        });

        roleByName.set(roleName, role.id);

        const rolePermissionRows = rolePermissions
          .map((permissionKey) => permissionByKey.get(permissionKey))
          .filter((permission): permission is Permission => Boolean(permission))
          .map((permission) => ({
            tenantId: tenant.id,
            roleId: role.id,
            permissionId: permission.id,
          }));

        if (rolePermissionRows.length > 0) {
          await tx.rolePermission.createMany({
            data: rolePermissionRows,
            skipDuplicates: true,
          });
        }
      }

      const companyAdminRoleId = roleByName.get(ROLE_NAMES.COMPANY_ADMIN);

      if (!companyAdminRoleId) {
        throw new AppError(
          'Default company_admin role was not created during tenant bootstrap',
          StatusCodes.INTERNAL_SERVER_ERROR,
          ERROR_CODES.INTERNAL_SERVER_ERROR,
        );
      }

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          passwordHash: input.passwordHash,
          status: UserStatus.active,
        },
      });

      await tx.userRole.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: companyAdminRoleId,
        },
      });

      return { tenant, user, permissions };
    }, {
      maxWait: 10000,
      timeout: 30000,
    });
  },

  async bootstrapCandidateUser(input: BootstrapCandidateUserInput): Promise<{ tenant: Tenant; user: User }> {
    return prisma.$transaction(async (tx) => {
      let tenant = await tx.tenant.findUnique({
        where: { slug: input.tenantSlug },
      });

      if (!tenant) {
        tenant = await tx.tenant.create({
          data: {
            name: input.tenantName,
            slug: input.tenantSlug,
          },
        });
      }

      await tx.permission.createMany({
        data: input.permissionKeys.map((key) => ({
          tenantId: tenant.id,
          key,
        })),
        skipDuplicates: true,
      });

      const candidateRole = await tx.role.upsert({
        where: {
          tenantId_name: {
            tenantId: tenant.id,
            name: ROLE_NAMES.CANDIDATE,
          },
        },
        update: {
          description: 'Default candidate role',
        },
        create: {
          tenantId: tenant.id,
          name: ROLE_NAMES.CANDIDATE,
          description: 'Default candidate role',
        },
      });

      const candidatePermissions = DEFAULT_ROLE_PERMISSION_MATRIX[ROLE_NAMES.CANDIDATE];
      if (candidatePermissions.length > 0) {
        const permissions = await tx.permission.findMany({
          where: {
            tenantId: tenant.id,
            key: { in: candidatePermissions },
          },
        });

        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            tenantId: tenant.id,
            roleId: candidateRole.id,
            permissionId: permission.id,
          })),
          skipDuplicates: true,
        });
      }

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          passwordHash: input.passwordHash,
          status: UserStatus.active,
        },
      });

      await tx.userRole.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: candidateRole.id,
        },
      });

      return { tenant, user };
    }, {
      maxWait: 10000,
      timeout: 30000,
    });
  },

  async createCompanyRegistrationRequest(input: CompanyRegistrationRequestInput) {
    return prisma.companyRegistrationRequest.create({
      data: {
        companyName: input.companyName,
        companyAddress: input.companyAddress,
        industry: input.industry,
        companySize: input.companySize,
        companyType: input.companyType,
        foundedYear: input.foundedYear,
        companyWebsite: input.companyWebsite,
        officialCompanyAddress: input.officialCompanyAddress,
        phoneNumber: input.phoneNumber,
        companyLogo: input.companyLogo,
        shortDescription: input.shortDescription,
        linkedinUrl: input.linkedinUrl,
        twitterUrl: input.twitterUrl,
        termsAccepted: input.termsAccepted,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
      },
    });
  },

  async findUserByTenantSlugAndEmail(tenantSlug: string, email: string): Promise<(User & { tenant: Tenant }) | null> {
    return prisma.user.findFirst({
      where: {
        email,
        tenant: {
          slug: tenantSlug,
        },
      },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  },

  async findUserByIdAndTenant(id: string, tenantId: string): Promise<(User & { tenant: Tenant }) | null> {
    return prisma.user.findFirst({
      where: { id, tenantId },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  },

  async createSession(data: {
    tenantId: string;
    userId: string;
    refreshTokenHash: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }) {
    return prisma.session.create({ data });
  },

  async findValidSession(userId: string, tenantId: string, refreshTokenHash: string) {
    return prisma.session.findFirst({
      where: {
        userId,
        tenantId,
        refreshTokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  },

  async revokeSession(id: string) {
    return prisma.session.update({
      where: { id },
      data: {
        revokedAt: new Date(),
      },
    });
  },

  async findTenantBySlug(slug: string): Promise<Tenant | null> {
    return prisma.tenant.findUnique({
      where: { slug },
    });
  },

  async findUserByTenantAndEmail(tenantId: string, email: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { tenantId, email },
    });
  },

  async createInviteToken(data: {
    tenantId: string;
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<InviteToken> {
    return prisma.inviteToken.create({ data });
  },

  async findInviteTokenByToken(token: string): Promise<(InviteToken & { user: User; tenant: Tenant }) | null> {
    return prisma.inviteToken.findUnique({
      where: { token },
      include: { user: true, tenant: true },
    });
  },

  async markInviteTokenUsed(id: string): Promise<InviteToken> {
    return prisma.inviteToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  },

  async createPasswordResetToken(data: {
    tenantId: string;
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<PasswordResetToken> {
    return prisma.passwordResetToken.create({ data });
  },

  async findPasswordResetTokenByToken(token: string): Promise<(PasswordResetToken & { user: User; tenant: Tenant }) | null> {
    return prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true, tenant: true },
    });
  },

  async markPasswordResetTokenUsed(id: string): Promise<PasswordResetToken> {
    return prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  },

  async activateUserWithPassword(userId: string, tenantId: string, passwordHash: string): Promise<User> {
    const updated = await prisma.user.updateMany({
      where: { id: userId, tenantId },
      data: { passwordHash, status: UserStatus.active },
    });

    if (updated.count === 0) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    // updateMany succeeded, so user must exist
    return user as User;
  },

  async updateUserPassword(userId: string, passwordHash: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
      },
    });
  },

  async consumeLoginOtp(userId: string, tenantId: string) {
    return prisma.user.updateMany({
      where: { id: userId, tenantId },
      data: {
        otpRequired: false,
        loginOtpHash: null,
        loginOtpExpiresAt: null,
      },
    });
  },
};
