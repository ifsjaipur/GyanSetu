import { z } from "zod/v4";

export const institutionBrandingSchema = z.object({
  logoUrl: z.url(),
  faviconUrl: z.url(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color"),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color"),
  headerBgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color"),
  footerText: z.string().max(500),
  institutionTagline: z.string().max(200),
});

export const institutionContactInfoSchema = z.object({
  supportEmail: z.email(),
  phone: z.string().min(10).max(15),
  address: z.string().max(500),
  website: z.url(),
});

export const createInstitutionSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  domains: z.array(z.string().min(3)).min(1),
  primaryDomain: z.string().min(3),
  allowedEmailDomains: z.array(z.string().min(3)),
  branding: institutionBrandingSchema,
  contactInfo: institutionContactInfoSchema,
  settings: z.object({
    defaultCourseAccessDays: z.number().int().min(1).max(365),
    enableSelfRegistration: z.boolean(),
    allowExternalUsers: z.boolean(),
    requireEmailVerification: z.boolean(),
  }),
});

export const updateInstitutionSchema = createInstitutionSchema.partial();

export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>;
export type UpdateInstitutionInput = z.infer<typeof updateInstitutionSchema>;
