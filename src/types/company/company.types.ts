import { CompanyType } from '@prisma/client';

export type CompanyAddress = {
  country: string;
  state: string;
  city: string;
  fullAddress: string;
  zipCode: string;
};

export type CreateCompanyInput = {
  companyName: string;
  companyAddress: CompanyAddress;
  industry: string;
  companySize: string;
  companyType: CompanyType;
  foundedYear: number;
  companyWebsite: string;
  officialCompanyAddress: string;
  phoneNumber?: string;
  companyLogo: string;
  shortDescription: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  termsAccepted: true;
};

export type UpdateCompanyInput = Partial<CreateCompanyInput>;
