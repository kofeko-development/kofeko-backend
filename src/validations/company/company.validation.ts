import { z } from 'zod';

const currentYear = new Date().getFullYear();

const companyTypeEnum = z.enum(['startup', 'enterprise', 'agency', 'non_profit']);

export const createCompanySchema = z.object({
  body: z.object({
    companyName: z.string().min(2).max(120),
    companyAddress: z.object({
      country: z.string().min(2).max(56),
      state: z.string().min(2).max(80),
      city: z.string().min(2).max(80),
      fullAddress: z.string().min(5).max(255),
      zipCode: z.string().min(3).max(20),
    }),
    industry: z.string().min(2).max(120),
    companySize: z.string().min(1).max(50),
    companyType: companyTypeEnum,
    foundedYear: z.number().int().min(1800).max(currentYear),
    companyWebsite: z.url(),
    officialCompanyAddress: z.string().min(5).max(255),
    phoneNumber: z.string().min(6).max(20).optional(),
    companyLogo: z.url(),
    shortDescription: z.string().min(20).max(1000),
    linkedinUrl: z.url().optional(),
    twitterUrl: z.url().optional(),
    termsAccepted: z.literal(true),
  }),
});

export const updateCompanySchema = z.object({
  params: z.object({
    id: z.uuid(),
  }),
  body: createCompanySchema.shape.body.partial(),
});

export const companyIdParamSchema = z.object({
  params: z.object({
    id: z.uuid(),
  }),
});
