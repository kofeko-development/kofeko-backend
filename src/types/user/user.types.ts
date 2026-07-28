import { UserStatus } from '@prisma/client';
import { RoleNameValue } from '../../common/constants/roles';

export type CreateUserInput = {
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleName?: RoleNameValue;
  status?: UserStatus;
};

export type InviteUserInput = {
  tenantId: string;
  actorId?: string;
  firstName: string;
  lastName: string;
  email: string;
  roleName?: RoleNameValue;
  roleId?: string;
  /** Shown in email / audit; required when `permissionKeys` is set. */
  position?: string;
  /** When non-empty, creates a tenant-specific role with these permissions (invite “Other”). */
  permissionKeys?: string[];
};

export type UpdateUserInput = Partial<{
  firstName: string;
  lastName: string;
  status: UserStatus;
  roleName: string;
}>;
