import { CompanyType } from '@prisma/client';

export type CreateCompanyInput = {
  companyName: string;
  industry: string;
  companySize: '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+';
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
