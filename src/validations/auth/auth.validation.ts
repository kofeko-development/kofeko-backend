import { z } from 'zod';

export const registerAdminSchema = z.object({
  body: z.object({
    tenantName: z.string().min(2).max(120),
    tenantSlug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
    firstName: z.string().min(2).max(80),
    lastName: z.string().min(1).max(80),
    email: z.email(),
    password: z.string().min(8).max(128),
  }),
});

const optionalUrl = z
  .union([z.literal(''), z.url({ error: 'Please enter a valid URL (example: https://example.com)' })])
  .optional()
  .transform((value) => value || undefined);

export const registerCompanyRequestSchema = z.object({
  body: z.object({
    companyName: z.string().min(2, 'Company name must be at least 2 characters').max(160),
    companyAddress: z.object({
      country: z.string().min(2, 'Country is required').max(100),
      state: z.string().min(2, 'State is required').max(100),
      city: z.string().min(2, 'City is required').max(100),
      zipCode: z.string().min(3, 'ZIP code is required').max(20),
      fullAddress: z.string().min(5, 'Full address must be at least 5 characters').max(500),
    }),
    industry: z.string().min(2, 'Industry is required').max(120),
    companySize: z.string().min(1, 'Company size is required').max(60),
    companyType: z.enum(['startup', 'enterprise', 'agency', 'non_profit']),
    foundedYear: z.coerce.number().int().min(1800, 'Founded year is invalid').max(new Date().getFullYear(), 'Founded year cannot be in the future'),
    companyWebsite: z.url({ error: 'Please enter a valid company website URL (https://...)' }),
    officialCompanyAddress: z.string().min(5, 'Official company address must be at least 5 characters').max(500),
    phoneNumber: z.string().min(7, 'Phone number must be at least 7 characters').max(30).optional(),
    companyLogo: z.url({ error: 'Please enter a valid company logo URL (https://...)' }),
    shortDescription: z.string().min(20, 'Short description must be at least 20 characters').max(1000),
    linkedinUrl: optionalUrl,
    twitterUrl: optionalUrl,
    termsAccepted: z.literal(true),
    contactName: z.string().min(2, 'Contact name is required').max(120),
    contactEmail: z.email('Please enter a valid contact email'),
  }),
});

export const registerCandidateSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).max(80),
    lastName: z.string().min(1).max(80),
    email: z.email(),
    password: z.string().min(8).max(128),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    tenantSlug: z.string().min(2).max(60),
    email: z.email(),
    password: z.string().min(8).max(128),
    otp: z.string().min(4).max(12).optional(),
  }),
});

export const loginCandidateSchema = z.object({
  body: z.object({
    email: z.email(),
    password: z.string().min(8).max(128),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10),
  }),
});

export const logoutSchema = refreshSchema;
