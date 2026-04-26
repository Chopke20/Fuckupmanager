import { z } from 'zod'
import { CompanyCodeSchema } from './auth.schema'

const NullableTrimmed = z.string().trim().max(500).nullable().optional()
const NullableUrl = z.string().trim().url().nullable().optional()

const ProjectContactSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(80).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
})

const LogoVariantSchema = z.enum(['DARK', 'LIGHT'])

export const AppSettingsSchema = z.object({
  brandName: z.string().trim().min(1).max(120),
  brandTagline: NullableTrimmed,
  loginHeadline: NullableTrimmed,
  supportEmail: z.string().trim().email().nullable().optional(),
  supportPhone: z.string().trim().max(80).nullable().optional(),
  websiteUrl: NullableUrl,
  legalFooter: NullableTrimmed,
  logoDarkBgUrl: NullableUrl,
  logoLightBgUrl: NullableUrl,
  primaryColorHex: z.string().trim().regex(/^#?[0-9a-fA-F]{6}$/).nullable().optional(),
  documentFooterText: NullableTrimmed,
  warehouseAddress: NullableTrimmed,
  projectContacts: z.array(ProjectContactSchema).optional().nullable(),
  defaultProjectContactId: z.string().trim().min(1).max(64).optional().nullable(),
  sidebarLogoVariant: LogoVariantSchema.nullable().optional(),
  loginLogoVariant: LogoVariantSchema.nullable().optional(),
  documentsLogoVariant: LogoVariantSchema.nullable().optional(),
  emailSenderName: z.string().trim().max(160).nullable().optional(),
  emailFooterText: NullableTrimmed,
  replyToEmail: z.string().trim().email().nullable().optional(),
})

export const AppSettingsPublicSchema = z.object({
  companyCode: CompanyCodeSchema,
  brandName: z.string().trim().min(1),
  brandTagline: z.string().trim().nullable().optional(),
  loginHeadline: z.string().trim().nullable().optional(),
  logoDarkBgUrl: z.string().trim().url().nullable().optional(),
  logoLightBgUrl: z.string().trim().url().nullable().optional(),
  loginLogoVariant: LogoVariantSchema.nullable().optional(),
  primaryColorHex: z.string().trim().nullable().optional(),
  supportEmail: z.string().trim().nullable().optional(),
  supportPhone: z.string().trim().nullable().optional(),
  websiteUrl: z.string().trim().nullable().optional(),
})

export const UpdateAppSettingsSchema = AppSettingsSchema.partial()

export type AppSettings = z.infer<typeof AppSettingsSchema>
export type AppSettingsPublic = z.infer<typeof AppSettingsPublicSchema>
