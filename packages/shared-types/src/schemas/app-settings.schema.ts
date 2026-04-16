import { z } from 'zod'

export const LoginOptionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  loginUrl: z.string().trim().url(),
  logoUrl: z.string().trim().url().optional(),
})

export const AppSettingsPublicSchema = z.object({
  instanceCode: z.string().trim().min(1),
  brandName: z.string().trim().min(1),
  brandTagline: z.string().trim().optional(),
  loginHeadline: z.string().trim().optional(),
  supportEmail: z.string().trim().optional(),
  supportPhone: z.string().trim().optional(),
  websiteUrl: z.string().trim().url().optional(),
  legalFooter: z.string().trim().optional(),
  logoDarkBgUrl: z.string().trim().url().optional(),
  logoLightBgUrl: z.string().trim().url().optional(),
  primaryColorHex: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/, 'Kolor musi mieć format #RRGGBB.').optional(),
  loginOptions: z.array(LoginOptionSchema),
})

export const AppSettingsAdminSchema = AppSettingsPublicSchema.extend({
  documentLogoUrl: z.string().trim().url().optional(),
  documentFooterText: z.string().trim().max(300).optional(),
  emailSenderName: z.string().trim().max(160).optional(),
  emailFooterText: z.string().trim().max(300).optional(),
  replyToEmail: z.string().trim().email().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const UpdateAppSettingsSchema = z.object({
  brandName: z.string().trim().min(1).max(120).optional(),
  brandTagline: z.string().trim().max(120).optional().nullable(),
  loginHeadline: z.string().trim().max(240).optional().nullable(),
  supportEmail: z.string().trim().email().optional().nullable(),
  supportPhone: z.string().trim().max(80).optional().nullable(),
  websiteUrl: z.string().trim().url().optional().nullable(),
  legalFooter: z.string().trim().max(300).optional().nullable(),
  logoDarkBgUrl: z.string().trim().url().optional().nullable(),
  logoLightBgUrl: z.string().trim().url().optional().nullable(),
  documentLogoUrl: z.string().trim().url().optional().nullable(),
  primaryColorHex: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{6})$/, 'Kolor musi mieć format #RRGGBB.')
    .optional()
    .nullable(),
  documentFooterText: z.string().trim().max(300).optional().nullable(),
  emailSenderName: z.string().trim().max(160).optional().nullable(),
  emailFooterText: z.string().trim().max(300).optional().nullable(),
  replyToEmail: z.string().trim().email().optional().nullable(),
  loginOptions: z.array(LoginOptionSchema).max(10).optional(),
})

export type LoginOption = z.infer<typeof LoginOptionSchema>
export type AppSettingsPublic = z.infer<typeof AppSettingsPublicSchema>
export type AppSettingsAdmin = z.infer<typeof AppSettingsAdminSchema>
export type UpdateAppSettingsInput = z.infer<typeof UpdateAppSettingsSchema>
