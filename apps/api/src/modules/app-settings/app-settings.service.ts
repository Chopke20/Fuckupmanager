import { AppSettingsPublicSchema, AppSettingsSchema, PublicCompanySchema, UpdateAppSettingsSchema } from '@lama-stage/shared-types'
import { prisma } from '../../prisma/client'
import { getCompanyByCode, getCompanyRegistry } from '../companies/company-registry'
import { getCurrentCompanyCode, runWithCompanyContext } from '../../shared/context/company-context'
import { AppError } from '../../shared/errors/AppError'

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const next = value.trim()
  return next.length > 0 ? next : null
}

function normalizeHex(value: string | null): string | null {
  if (!value) return null
  const next = value.startsWith('#') ? value : `#${value}`
  return next.toUpperCase()
}

function defaultSettingsForCompany(companyCode: string) {
  const company = getCompanyByCode(companyCode)
  return {
    brandName: company?.displayName ?? 'Lama Stage',
    brandTagline: null,
    loginHeadline: null,
    supportEmail: null,
    supportPhone: null,
    websiteUrl: null,
    legalFooter: null,
    logoDarkBgUrl: company?.logoDarkBgUrl ?? null,
    logoLightBgUrl: company?.logoLightBgUrl ?? null,
    primaryColorHex: null,
    documentFooterText: null,
    warehouseAddress: null,
    projectContactsJson: null,
    defaultProjectContactId: null,
    sidebarLogoVariant: null,
    loginLogoVariant: null,
    documentsLogoVariant: null,
    emailSenderName: null,
    emailFooterText: null,
    replyToEmail: null,
  }
}

async function getOrCreateSettingsRow() {
  const currentCompanyCode = getCurrentCompanyCode()
  const row = await prisma.appSettings.findUnique({ where: { id: 1 } })
  if (row) return row
  return prisma.appSettings.create({ data: defaultSettingsForCompany(currentCompanyCode) })
}

function toPublicDto(companyCode: string, row: Awaited<ReturnType<typeof getOrCreateSettingsRow>>) {
  return AppSettingsPublicSchema.parse({
    companyCode,
    brandName: row.brandName,
    brandTagline: row.brandTagline,
    loginHeadline: row.loginHeadline,
    logoDarkBgUrl: row.logoDarkBgUrl,
    logoLightBgUrl: row.logoLightBgUrl,
    loginLogoVariant: (row as { loginLogoVariant?: 'DARK' | 'LIGHT' | null }).loginLogoVariant ?? null,
    primaryColorHex: row.primaryColorHex,
    supportEmail: row.supportEmail,
    supportPhone: row.supportPhone,
    websiteUrl: row.websiteUrl,
  })
}

export async function getCurrentCompanyAppSettings() {
  const row = await getOrCreateSettingsRow()
  const contacts = (() => {
    const raw = (row as { projectContactsJson?: string | null }).projectContactsJson
    if (!raw || !raw.trim()) return null
    try {
      return JSON.parse(raw) as unknown
    } catch {
      return null
    }
  })()
  return AppSettingsSchema.parse({
    brandName: row.brandName,
    brandTagline: row.brandTagline,
    loginHeadline: row.loginHeadline,
    supportEmail: row.supportEmail,
    supportPhone: row.supportPhone,
    websiteUrl: row.websiteUrl,
    legalFooter: row.legalFooter,
    logoDarkBgUrl: row.logoDarkBgUrl,
    logoLightBgUrl: row.logoLightBgUrl,
    primaryColorHex: row.primaryColorHex,
    documentFooterText: row.documentFooterText,
    warehouseAddress: (row as { warehouseAddress?: string | null }).warehouseAddress ?? null,
    projectContacts: contacts as any,
    defaultProjectContactId: (row as { defaultProjectContactId?: string | null }).defaultProjectContactId ?? null,
    sidebarLogoVariant: (row as { sidebarLogoVariant?: string | null }).sidebarLogoVariant ?? null,
    loginLogoVariant: (row as { loginLogoVariant?: string | null }).loginLogoVariant ?? null,
    documentsLogoVariant: (row as { documentsLogoVariant?: string | null; offerLogoVariant?: string | null }).documentsLogoVariant
      ?? (row as { offerLogoVariant?: string | null }).offerLogoVariant
      ?? null,
    emailSenderName: row.emailSenderName,
    emailFooterText: row.emailFooterText,
    replyToEmail: row.replyToEmail,
  })
}

export async function updateCurrentCompanyAppSettings(payload: unknown) {
  const parsed = UpdateAppSettingsSchema.safeParse(payload)
  if (!parsed.success) {
    throw new AppError('Nieprawidłowe dane ustawień aplikacji.', 400, 'VALIDATION_ERROR', parsed.error.flatten())
  }
  await getOrCreateSettingsRow()
  const data = parsed.data

  const hasKey = (obj: unknown, key: string) =>
    typeof obj === 'object' && obj !== null && Object.prototype.hasOwnProperty.call(obj, key)

  const nextContactsJson =
    hasKey(data, 'projectContacts')
      ? (() => {
          const v = (data as { projectContacts?: unknown }).projectContacts
          if (v == null) return null
          try {
            return JSON.stringify(v)
          } catch {
            return null
          }
        })()
      : undefined

  const nextWarehouseAddress =
    hasKey(data, 'warehouseAddress')
      ? trimOrNull((data as { warehouseAddress?: unknown }).warehouseAddress)
      : undefined

  const nextDefaultProjectContactId =
    hasKey(data, 'defaultProjectContactId')
      ? trimOrNull((data as { defaultProjectContactId?: unknown }).defaultProjectContactId)
      : undefined
  const updated = await prisma.appSettings.update({
    where: { id: 1 },
    data: {
      brandName: trimOrNull(data.brandName) ?? undefined,
      brandTagline: trimOrNull(data.brandTagline),
      loginHeadline: trimOrNull(data.loginHeadline),
      supportEmail: trimOrNull(data.supportEmail),
      supportPhone: trimOrNull(data.supportPhone),
      websiteUrl: trimOrNull(data.websiteUrl),
      legalFooter: trimOrNull(data.legalFooter),
      logoDarkBgUrl: trimOrNull(data.logoDarkBgUrl),
      logoLightBgUrl: trimOrNull(data.logoLightBgUrl),
      primaryColorHex: normalizeHex(trimOrNull(data.primaryColorHex)),
      documentFooterText: trimOrNull(data.documentFooterText),
      warehouseAddress: nextWarehouseAddress,
      projectContactsJson: nextContactsJson,
      defaultProjectContactId: nextDefaultProjectContactId,
      sidebarLogoVariant: trimOrNull((data as { sidebarLogoVariant?: unknown }).sidebarLogoVariant),
      loginLogoVariant: trimOrNull((data as { loginLogoVariant?: unknown }).loginLogoVariant),
      documentsLogoVariant: trimOrNull((data as { documentsLogoVariant?: unknown }).documentsLogoVariant),
      emailSenderName: trimOrNull(data.emailSenderName),
      emailFooterText: trimOrNull(data.emailFooterText),
      replyToEmail: trimOrNull(data.replyToEmail),
    },
  })
  return AppSettingsSchema.parse({
    brandName: updated.brandName,
    brandTagline: updated.brandTagline,
    loginHeadline: updated.loginHeadline,
    supportEmail: updated.supportEmail,
    supportPhone: updated.supportPhone,
    websiteUrl: updated.websiteUrl,
    legalFooter: updated.legalFooter,
    logoDarkBgUrl: updated.logoDarkBgUrl,
    logoLightBgUrl: updated.logoLightBgUrl,
    primaryColorHex: updated.primaryColorHex,
    documentFooterText: updated.documentFooterText,
    warehouseAddress: (updated as { warehouseAddress?: string | null }).warehouseAddress ?? null,
    projectContacts: (() => {
      const raw = (updated as { projectContactsJson?: string | null }).projectContactsJson
      if (!raw || !raw.trim()) return null
      try {
        return JSON.parse(raw) as unknown
      } catch {
        return null
      }
    })() as any,
    defaultProjectContactId: (updated as { defaultProjectContactId?: string | null }).defaultProjectContactId ?? null,
    sidebarLogoVariant: (updated as { sidebarLogoVariant?: string | null }).sidebarLogoVariant ?? null,
    loginLogoVariant: (updated as { loginLogoVariant?: string | null }).loginLogoVariant ?? null,
    documentsLogoVariant: (updated as { documentsLogoVariant?: string | null; offerLogoVariant?: string | null }).documentsLogoVariant
      ?? (updated as { offerLogoVariant?: string | null }).offerLogoVariant
      ?? null,
    emailSenderName: updated.emailSenderName,
    emailFooterText: updated.emailFooterText,
    replyToEmail: updated.replyToEmail,
  })
}

export async function getPublicSettingsForCompany(companyCode: string) {
  const row = await runWithCompanyContext(companyCode, async () => {
    const settings = await getOrCreateSettingsRow()
    return settings
  })
  return toPublicDto(companyCode, row)
}

export async function listPublicCompaniesWithBranding() {
  const companies = getCompanyRegistry()
  const result = await Promise.all(
    companies.map(async (company) => {
      try {
        const settings = await getPublicSettingsForCompany(company.code)
        return PublicCompanySchema.parse({
          code: company.code,
          displayName: settings.brandName || company.displayName,
          logoDarkBgUrl: settings.logoDarkBgUrl ?? company.logoDarkBgUrl ?? null,
          logoLightBgUrl: settings.logoLightBgUrl ?? company.logoLightBgUrl ?? null,
          loginLogoVariant: settings.loginLogoVariant ?? null,
          primaryColorHex: settings.primaryColorHex ?? null,
          loginHelpText: settings.loginHeadline ?? company.loginHelpText ?? null,
        })
      } catch {
        return PublicCompanySchema.parse({
          code: company.code,
          displayName: company.displayName,
          logoDarkBgUrl: company.logoDarkBgUrl ?? null,
          logoLightBgUrl: company.logoLightBgUrl ?? null,
          loginLogoVariant: null,
          primaryColorHex: null,
          loginHelpText: company.loginHelpText ?? null,
        })
      }
    })
  )
  return result
}
