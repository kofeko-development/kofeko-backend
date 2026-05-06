import { z } from 'zod';

const currentYear = new Date().getFullYear();

const companyTypeEnum = z.enum(['startup', 'enterprise', 'agency', 'non_profit']);
const companySizeEnum = z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']);

export const createCompanySchema = z.object({
  body: z.object({
    companyName: z.string().min(2).max(120),
    industry: z.string().min(2).max(120),
    companySize: companySizeEnum,
    companyType: companyTypeEnum,
    foundedYear: z.number().int().min(1800).max(currentYear),
    companyWebsite: z.string().url(),
    officialCompanyAddress: z.string().min(5).max(255),
    phoneNumber: z.string().min(6).max(20).optional(),
    companyLogo: z.string().url(),
    shortDescription: z.string().min(20).max(1000),
    linkedinUrl: z.string().url().optional(),
    twitterUrl: z.string().url().optional(),
    termsAccepted: z.literal(true),
  }),
});

export const updateCompanySchema = z.object({
  body: createCompanySchema.shape.body
    .partial()
    .extend({
      termsAccepted: z.literal(true).optional(),
    }),
});
