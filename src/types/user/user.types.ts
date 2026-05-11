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
  position?: string;
};

export type UpdateUserInput = Partial<{
  firstName: string;
  lastName: string;
  status: UserStatus;
}>;
