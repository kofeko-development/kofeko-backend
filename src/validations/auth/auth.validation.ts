import { z } from 'zod';
import { ensureHttpsUrl } from '../../common/utils/ensureHttpsUrl';

const websiteUrlSchema = z.preprocess(
  (value) => (typeof value === 'string' ? ensureHttpsUrl(value) : value),
  z.url({ error: 'Please enter a valid company website URL (https://...)' }),
);

const optionalWebsiteUrlSchema = z.preprocess(
  (value) => {
    if (value === '' || value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return value;
    const normalized = ensureHttpsUrl(value);
    return normalized || undefined;
  },
  z.url({ error: 'Please enter a valid URL (example: https://example.com)' }).optional(),
);

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

export const sendCompanySignupEmailOtpSchema = z.object({
  body: z.object({
    email: z.email('Enter a valid email address'),
  }),
});

export const verifyCompanySignupEmailOtpSchema = z.object({
  body: z.object({
    email: z.email('Enter a valid email address'),
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your email'),
  }),
});

export const sendCandidateSignupEmailOtpSchema = z.object({
  body: z.object({
    email: z.email('Enter a valid email address'),
  }),
});

export const verifyCandidateSignupEmailOtpSchema = z.object({
  body: z.object({
    email: z.email('Enter a valid email address'),
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your email'),
  }),
});

export const verifyCandidatePhoneOtpMsg91Schema = z.object({
  body: z.object({
    accessToken: z.string().min(10, 'MSG91 access token is required'),
  }),
});

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
    companySize: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']),
    companyType: z.enum(['startup', 'enterprise', 'agency', 'non_profit']),
    foundedYear: z.coerce.number().int().min(1800, 'Founded year is invalid').max(new Date().getFullYear(), 'Founded year cannot be in the future'),
    companyWebsite: websiteUrlSchema,
    officialCompanyAddress: z.string().min(5, 'Official company address must be at least 5 characters').max(500),
    phoneNumber: z
      .string()
      .min(9, 'Enter a valid phone number with country code')
      .max(22, 'Phone number is too long')
      .regex(/^\+\d{8,17}$/, 'Use international format with country code (e.g. +919876543210)'),
    companyLogo: z
      .string()
      .min(1, 'Upload a company logo before submitting')
      .url({ error: 'Please enter a valid company logo URL (https://...)' }),
    shortDescription: z.string().min(20, 'Short description must be at least 20 characters').max(1000),
    linkedinUrl: optionalWebsiteUrlSchema,
    twitterUrl: optionalWebsiteUrlSchema,
    termsAccepted: z.literal(true),
    contactName: z.string().min(2).max(120).optional(),
    contactEmail: z.email().optional(),
    adminEmail: z.email('Enter a valid company admin email'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    emailVerificationToken: z.string().min(20, 'Verify your email with the code we sent'),
  }),
});

export const registerCandidateSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).max(80),
    lastName: z.string().min(1).max(80),
    email: z.email(),
    password: z.string().min(8).max(128),
    emailVerificationToken: z.string().min(20, 'Verify your email with the code we sent'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    tenantSlug: z.string().min(2).max(60).optional(),
    email: z.email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  }),
});

export const loginCandidateSchema = z.object({
  body: z.object({
    email: z.email(),
    password: z.string().min(8).max(128),
  }),
});

export const loginCandidateGoogleSchema = z.object({
  body: z.object({
    idToken: z.string().min(50),
  }),
});

export const loginCandidateSupabaseSchema = z.object({
  body: z.object({
    accessToken: z.string().min(20),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10),
  }),
});

export const logoutSchema = refreshSchema;

const strongPasswordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const acceptInviteSchema = z.object({
  body: z.object({
    token: z.string().min(10),
    password: strongPasswordSchema,
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    tenantSlug: z.string().min(2).max(60).optional(),
    email: z.email(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(10),
    password: strongPasswordSchema,
  }),
});
