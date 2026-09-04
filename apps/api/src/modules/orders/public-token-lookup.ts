import { randomBytes } from 'node:crypto'
import { getCompanyRegistry } from '../companies/company-registry'
import { runWithCompanyContext } from '../../shared/context/company-context'

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/

export function isValidPublicToken(token: string): boolean {
  return TOKEN_RE.test(token)
}

export function newPublicToken(): string {
  return randomBytes(24).toString('base64url')
}

/**
 * Repo jest multi-company (osobna baza na firmę), a link publiczny nie ma kontekstu
 * sesji — dlatego token trzeba szukać po kolei we wszystkich bazach z rejestru.
 */
export async function findAcrossCompanies<T>(
  finder: () => Promise<T | null>
): Promise<{ companyCode: string; value: T } | null> {
  for (const company of getCompanyRegistry()) {
    const found = await runWithCompanyContext(company.code, finder)
    if (found) return { companyCode: company.code, value: found }
  }
  return null
}
