import type { AppSettings } from '@prisma/client'
import {
  AppSettingsAdminSchema,
  AppSettingsPublicSchema,
  type LoginOption,
  UpdateAppSettingsSchema,
} from '@lama-stage/shared-types'
import { prisma } from '../../prisma/client'
import { AppError } from '../../shared/errors/AppError'

const DEFAULT_BRAND_NAME = 'Lama Stage'

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const next = value.trim()
  return next.length > 0 ? next : null
}

function parseLoginOptions(raw: string): LoginOption[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getDefaultSettingsInput() {
  const brandName = trimOrNull(process.env.APP_BRAND_NAME) ?? DEFAULT_BRAND_NAME
  const supportEmail = trimOrNull(process.env.APP_SUPPORT_EMAIL)
  const supportPhone = trimOrNull(process.env.APP_SUPPORT_PHONE)
  const websiteUrl = trimOrNull(process.env.APP_WEBSITE_URL)
  const loginOptionsJson = (() => {
    const raw = trimOrNull(process.env.APP_LOGIN_OPTIONS_JSON)
    if (!raw) return '[]'
    try {
      const parsed = JSON.parse(raw)
      return JSON.stringify(Array.isArray(parsed) ? parsed : [])
    } catch {
      return '[]'
    }
  })()

  return {
    id: 1,
    instanceCode: trimOrNull(process.env.INSTANCE_CODE) ?? 'main',
    brandName,
    brandTagline: trimOrNull(process.env.APP_BRAND_TAGLINE),
    loginHeadline: trimOrNull(process.env.APP_LOGIN_HEADLINE),
    supportEmail,
    supportPhone,
    websiteUrl,
    legalFooter: trimOrNull(process.env.APP_LEGAL_FOOTER),
    logoDarkBgUrl: trimOrNull(process.env.APP_LOGO_DARK_URL),
    logoLightBgUrl: trimOrNull(process.env.APP_LOGO_LIGHT_URL),
    documentLogoUrl: trimOrNull(process.env.APP_DOCUMENT_LOGO_URL),
    primaryColorHex: trimOrNull(process.env.APP_PRIMARY_COLOR_HEX),
    loginOptionsJson,
    documentFooterText: trimOrNull(process.env.APP_DOCUMENT_FOOTER_TEXT),
    emailSenderName: trimOrNull(process.env.APP_EMAIL_SENDER_NAME) ?? brandName,
    emailFooterText: trimOrNull(process.env.APP_EMAIL_FOOTER_TEXT),
    replyToEmail: trimOrNull(process.env.APP_REPLY_TO_EMAIL) ?? supportEmail,
  }
}

function toAdminDto(row: AppSettings) {
  return AppSettingsAdminSchema.parse({
    instanceCode: row.instanceCode,
    brandName: row.brandName,
    brandTagline: row.brandTagline ?? undefined,
    loginHeadline: row.loginHeadline ?? undefined,
    supportEmail: row.supportEmail ?? undefined,
    supportPhone: row.supportPhone ?? undefined,
    websiteUrl: row.websiteUrl ?? undefined,
    legalFooter: row.legalFooter ?? undefined,
    logoDarkBgUrl: row.logoDarkBgUrl ?? undefined,
    logoLightBgUrl: row.logoLightBgUrl ?? undefined,
    documentLogoUrl: row.documentLogoUrl ?? undefined,
    primaryColorHex: row.primaryColorHex ?? undefined,
    loginOptions: parseLoginOptions(row.loginOptionsJson),
    documentFooterText: row.documentFooterText ?? undefined,
    emailSenderName: row.emailSenderName ?? undefined,
    emailFooterText: row.emailFooterText ?? undefined,
    replyToEmail: row.replyToEmail ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}

function toPublicDto(row: AppSettings) {
  return AppSettingsPublicSchema.parse({
    instanceCode: row.instanceCode,
    brandName: row.brandName,
    brandTagline: row.brandTagline ?? undefined,
    loginHeadline: row.loginHeadline ?? undefined,
    supportEmail: row.supportEmail ?? undefined,
    supportPhone: row.supportPhone ?? undefined,
    websiteUrl: row.websiteUrl ?? undefined,
    legalFooter: row.legalFooter ?? undefined,
    logoDarkBgUrl: row.logoDarkBgUrl ?? undefined,
    logoLightBgUrl: row.logoLightBgUrl ?? undefined,
    primaryColorHex: row.primaryColorHex ?? undefined,
    loginOptions: parseLoginOptions(row.loginOptionsJson),
  })
}

export async function getOrCreateAppSettings() {
  return prisma.appSettings.upsert({
    where: { id: 1 },
    create: getDefaultSettingsInput(),
    update: {},
  })
}

export async function getAdminAppSettings() {
  const settings = await getOrCreateAppSettings()
  return { data: toAdminDto(settings) }
}

export async function getPublicAppSettings() {
  const settings = await getOrCreateAppSettings()
  return { data: toPublicDto(settings) }
}

export async function updateAppSettings(body: unknown) {
  const parsed = UpdateAppSettingsSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError('Nieprawidłowe ustawienia aplikacji.', 400, 'VALIDATION_ERROR', parsed.error.flatten())
  }

  const payload = parsed.data
  const updated = await prisma.appSettings.upsert({
    where: { id: 1 },
    create: {
      ...getDefaultSettingsInput(),
      brandName: payload.brandName?.trim() || getDefaultSettingsInput().brandName,
      brandTagline: payload.brandTagline === undefined ? null : trimOrNull(payload.brandTagline),
      loginHeadline: payload.loginHeadline === undefined ? null : trimOrNull(payload.loginHeadline),
      supportEmail: payload.supportEmail === undefined ? null : trimOrNull(payload.supportEmail),
      supportPhone: payload.supportPhone === undefined ? null : trimOrNull(payload.supportPhone),
      websiteUrl: payload.websiteUrl === undefined ? null : trimOrNull(payload.websiteUrl),
      legalFooter: payload.legalFooter === undefined ? null : trimOrNull(payload.legalFooter),
      logoDarkBgUrl: payload.logoDarkBgUrl === undefined ? null : trimOrNull(payload.logoDarkBgUrl),
      logoLightBgUrl: payload.logoLightBgUrl === undefined ? null : trimOrNull(payload.logoLightBgUrl),
      documentLogoUrl: payload.documentLogoUrl === undefined ? null : trimOrNull(payload.documentLogoUrl),
      primaryColorHex: payload.primaryColorHex === undefined ? null : trimOrNull(payload.primaryColorHex),
      loginOptionsJson: JSON.stringify(payload.loginOptions ?? []),
      documentFooterText: payload.documentFooterText === undefined ? null : trimOrNull(payload.documentFooterText),
      emailSenderName: payload.emailSenderName === undefined ? null : trimOrNull(payload.emailSenderName),
      emailFooterText: payload.emailFooterText === undefined ? null : trimOrNull(payload.emailFooterText),
      replyToEmail: payload.replyToEmail === undefined ? null : trimOrNull(payload.replyToEmail),
    },
    update: {
      ...(payload.brandName !== undefined ? { brandName: payload.brandName.trim() } : {}),
      ...(payload.brandTagline !== undefined ? { brandTagline: trimOrNull(payload.brandTagline) } : {}),
      ...(payload.loginHeadline !== undefined ? { loginHeadline: trimOrNull(payload.loginHeadline) } : {}),
      ...(payload.supportEmail !== undefined ? { supportEmail: trimOrNull(payload.supportEmail) } : {}),
      ...(payload.supportPhone !== undefined ? { supportPhone: trimOrNull(payload.supportPhone) } : {}),
      ...(payload.websiteUrl !== undefined ? { websiteUrl: trimOrNull(payload.websiteUrl) } : {}),
      ...(payload.legalFooter !== undefined ? { legalFooter: trimOrNull(payload.legalFooter) } : {}),
      ...(payload.logoDarkBgUrl !== undefined ? { logoDarkBgUrl: trimOrNull(payload.logoDarkBgUrl) } : {}),
      ...(payload.logoLightBgUrl !== undefined ? { logoLightBgUrl: trimOrNull(payload.logoLightBgUrl) } : {}),
      ...(payload.documentLogoUrl !== undefined ? { documentLogoUrl: trimOrNull(payload.documentLogoUrl) } : {}),
      ...(payload.primaryColorHex !== undefined ? { primaryColorHex: trimOrNull(payload.primaryColorHex) } : {}),
      ...(payload.loginOptions !== undefined ? { loginOptionsJson: JSON.stringify(payload.loginOptions) } : {}),
      ...(payload.documentFooterText !== undefined ? { documentFooterText: trimOrNull(payload.documentFooterText) } : {}),
      ...(payload.emailSenderName !== undefined ? { emailSenderName: trimOrNull(payload.emailSenderName) } : {}),
      ...(payload.emailFooterText !== undefined ? { emailFooterText: trimOrNull(payload.emailFooterText) } : {}),
      ...(payload.replyToEmail !== undefined ? { replyToEmail: trimOrNull(payload.replyToEmail) } : {}),
    },
  })

  return { data: toAdminDto(updated) }
}
