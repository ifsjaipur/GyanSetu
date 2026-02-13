import { z } from "zod/v4";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color");
const optionalUrl = z.union([z.url(), z.literal("")]);

export const institutionBrandingSchema = z.object({
  logoUrl: z.url(),
  faviconUrl: z.url(),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  accentColor: hexColor,
  headerBgColor: hexColor,
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

/** Relaxed schema for updates — allows empty strings for optional URLs, all fields optional */
export const updateInstitutionSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  domains: z.array(z.string().min(3)).min(1).optional(),
  primaryDomain: z.string().min(3).optional(),
  allowedEmailDomains: z.array(z.string().min(3)).optional(),
  branding: z.object({
    logoUrl: optionalUrl.optional(),
    faviconUrl: optionalUrl.optional(),
    primaryColor: hexColor.optional(),
    secondaryColor: hexColor.optional(),
    accentColor: hexColor.optional(),
    headerBgColor: hexColor.optional(),
    footerText: z.string().max(500).optional(),
    institutionTagline: z.string().max(200).optional(),
  }).optional(),
  contactInfo: z.object({
    supportEmail: z.union([z.email(), z.literal("")]).optional(),
    phone: z.union([z.string().min(10).max(15), z.literal("")]).optional(),
    address: z.string().max(500).optional(),
    website: optionalUrl.optional(),
  }).optional(),
  settings: z.object({
    defaultCourseAccessDays: z.number().int().min(1).max(365).optional(),
    enableSelfRegistration: z.boolean().optional(),
    allowExternalUsers: z.boolean().optional(),
    requireEmailVerification: z.boolean().optional(),
    maintenanceMode: z.boolean().optional(),
    locale: z.string().max(10).optional(),
  }).optional(),
});

export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>;
export type UpdateInstitutionInput = z.infer<typeof updateInstitutionSchema>;
