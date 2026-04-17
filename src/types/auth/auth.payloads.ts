export type RegisterAdminInput = {
  tenantName: string;
  tenantSlug: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type LoginInput = {
  tenantSlug: string;
  email: string;
  password: string;
};

export type RefreshTokenInput = {
  refreshToken: string;
};
