const SESSION_COOKIE_NAME = 'lama_session'

function normalizeCompanyCode(input: string): string {
  return input.trim().toLowerCase()
}

function isValidCompanyCode(code: string): boolean {
  return /^[a-z0-9_-]{2,32}$/.test(code)
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME
}

export function createSessionCookieValue(companyCode: string, sessionToken: string): string {
  const normalized = normalizeCompanyCode(companyCode)
  if (!isValidCompanyCode(normalized)) {
    throw new Error('Nieprawidłowy kod firmy dla sesji.')
  }
  return `${normalized}.${sessionToken}`
}

export function parseSessionCookieValue(value: string | null | undefined): { companyCode: string; token: string } | null {
  if (!value) return null
  const idx = value.indexOf('.')
  if (idx < 1) return null
  const companyCode = normalizeCompanyCode(value.slice(0, idx))
  const token = value.slice(idx + 1)
  if (!isValidCompanyCode(companyCode) || token.length < 10) return null
  return { companyCode, token }
}
