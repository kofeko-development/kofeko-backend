export type RegisterAdminInput = {
  tenantName: string;
  tenantSlug: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type RegisterCompanyRequestInput = {
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
  contactName?: string;
  contactEmail?: string;
  /** Company admin login email (used after approval with the chosen password). */
  adminEmail: string;
  password: string;
  /** Issued after successful email OTP verification (must match adminEmail). */
  emailVerificationToken: string;
};

export type RegisterCandidateInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  emailVerificationToken: string;
};

export type LoginInput = {
  tenantSlug?: string;
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
