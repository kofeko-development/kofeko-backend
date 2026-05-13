export type JwtPayloadData = {
  sub: string;
  tenantId: string;
  email: string;
  type?: string;
};

export type AuthenticatedUser = {
  userId: string;
  tenantId: string;
  email: string;
};

export const COMPANY_REGISTRATION_EMAIL_JWT_TYP = 'company_reg_email' as const;

export type CompanyRegistrationEmailJwtPayload = {
  typ: typeof COMPANY_REGISTRATION_EMAIL_JWT_TYP;
  email: string;
};
