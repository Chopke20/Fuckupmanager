type CompanyRegistryEntry = {
  code: string
  displayName: string
  databaseUrl: string
  logoDarkBgUrl?: string | null
  logoLightBgUrl?: string | null
  loginHelpText?: string | null
  isDefault?: boolean
}

export type CompanyPublicInfo = {
  code: string
  displayName: string
  logoDarkBgUrl?: string | null
  logoLightBgUrl?: string | null
  loginHelpText?: string | null
}

function normalizeCode(input: string): string {
  return input.trim().toLowerCase()
}

function isValidCode(code: string): boolean {
  return /^[a-z0-9_-]{2,32}$/.test(code)
}

function databaseIdentity(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl)
    const dbName = url.pathname.replace(/^\/+/, '')
    return `${url.protocol}//${url.hostname}:${url.port || '5432'}/${dbName}`
  } catch {
    return databaseUrl
  }
}

function parseRegistryFromEnv(): CompanyRegistryEntry[] {
  const raw = process.env.COMPANY_DATABASES_JSON?.trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const rows: CompanyRegistryEntry[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const codeRaw = typeof (item as { code?: unknown }).code === 'string' ? (item as { code: string }).code : ''
      const code = normalizeCode(codeRaw)
      const displayName = typeof (item as { displayName?: unknown }).displayName === 'string'
        ? (item as { displayName: string }).displayName.trim()
        : ''
      const databaseUrl = typeof (item as { databaseUrl?: unknown }).databaseUrl === 'string'
        ? (item as { databaseUrl: string }).databaseUrl.trim()
        : ''
      if (!isValidCode(code) || !displayName || !databaseUrl) continue
      rows.push({
        code,
        displayName,
        databaseUrl,
        logoDarkBgUrl: typeof (item as { logoDarkBgUrl?: unknown }).logoDarkBgUrl === 'string'
          ? (item as { logoDarkBgUrl: string }).logoDarkBgUrl.trim()
          : null,
        logoLightBgUrl: typeof (item as { logoLightBgUrl?: unknown }).logoLightBgUrl === 'string'
          ? (item as { logoLightBgUrl: string }).logoLightBgUrl.trim()
          : null,
        loginHelpText: typeof (item as { loginHelpText?: unknown }).loginHelpText === 'string'
          ? (item as { loginHelpText: string }).loginHelpText.trim()
          : null,
        isDefault: Boolean((item as { isDefault?: unknown }).isDefault),
      })
    }
    return rows
  } catch {
    return []
  }
}

function fallbackSingleCompany(): CompanyRegistryEntry {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error('Brak DATABASE_URL i COMPANY_DATABASES_JSON - nie można zbudować rejestru firm.')
  }
  return {
    code: 'main',
    displayName: process.env.APP_BRAND_NAME?.trim() || 'Lama Stage',
    databaseUrl,
    logoDarkBgUrl: process.env.APP_LOGO_DARK_BG_URL?.trim() || null,
    logoLightBgUrl: process.env.APP_LOGO_LIGHT_BG_URL?.trim() || null,
    loginHelpText: process.env.APP_LOGIN_HELP_TEXT?.trim() || null,
    isDefault: true,
  }
}

let cachedRegistry: CompanyRegistryEntry[] | null = null

export function getCompanyRegistry(): CompanyRegistryEntry[] {
  if (cachedRegistry) return cachedRegistry
  const parsed = parseRegistryFromEnv()
  const base = parsed.length > 0 ? parsed : [fallbackSingleCompany()]
  const byCode = new Map<string, CompanyRegistryEntry>()
  for (const row of base) {
    if (!byCode.has(row.code)) byCode.set(row.code, row)
  }
  const rows = Array.from(byCode.values())
  const hasDefault = rows.some((r) => r.isDefault)
  if (!hasDefault && rows[0]) rows[0].isDefault = true
  const dbToCompany = new Map<string, string>()
  for (const row of rows) {
    const key = databaseIdentity(row.databaseUrl)
    const existing = dbToCompany.get(key)
    if (existing && existing !== row.code) {
      throw new Error(
        `Błąd konfiguracji: firmy '${existing}' i '${row.code}' wskazują na tę samą bazę (${key}).`
      )
    }
    dbToCompany.set(key, row.code)
  }
  cachedRegistry = rows
  return rows
}

export function getCompanyByCode(code: string): CompanyRegistryEntry | null {
  const normalized = normalizeCode(code)
  if (!isValidCode(normalized)) return null
  return getCompanyRegistry().find((row) => row.code === normalized) ?? null
}

export function getDefaultCompany(): CompanyRegistryEntry {
  return getCompanyRegistry().find((row) => row.isDefault) ?? getCompanyRegistry()[0]!
}

export function listPublicCompanies(): CompanyPublicInfo[] {
  return getCompanyRegistry().map((row) => ({
    code: row.code,
    displayName: row.displayName,
    logoDarkBgUrl: row.logoDarkBgUrl ?? null,
    logoLightBgUrl: row.logoLightBgUrl ?? null,
    loginHelpText: row.loginHelpText ?? null,
  }))
}

export function getCompanyDatabaseUrl(companyCode: string): string {
  const row = getCompanyByCode(companyCode)
  if (!row) {
    throw new Error(`Nieznana firma '${companyCode}'.`)
  }
  return row.databaseUrl
}
