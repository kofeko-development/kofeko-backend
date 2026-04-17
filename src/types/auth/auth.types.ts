export type JwtPayloadData = {
  sub: string;
  tenantId: string;
  email: string;
};

export type AuthenticatedUser = {
  userId: string;
  tenantId: string;
  email: string;
};
