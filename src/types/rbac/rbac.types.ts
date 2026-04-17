export type CreateRoleInput = {
  tenantId: string;
  name: string;
  description?: string;
};

export type CreatePermissionInput = {
  tenantId: string;
  key: string;
  description?: string;
};

export type AssignRoleToUserInput = {
  tenantId: string;
  userId: string;
  roleId: string;
};

export type AttachPermissionToRoleInput = {
  tenantId: string;
  roleId: string;
  permissionId: string;
};
