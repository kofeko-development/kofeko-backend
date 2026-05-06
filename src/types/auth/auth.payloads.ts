export type RegisterAdminInput = {
  tenantName: string;
  tenantSlug: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type RegisterCandidateInput = {
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

export type LoginCandidateInput = {
  email: string;
  password: string;
};

export type RefreshTokenInput = {
  refreshToken: string;
};

export type AcceptInviteInput = {
  token: string;
  password: string;
};

export type ForgotPasswordInput = {
  tenantSlug: string;
  email: string;
};

export type ResetPasswordInput = {
  token: string;
  password: string;
};
