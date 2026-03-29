/**
 * Pobieranie nazwy i adresu firmy po NIP — DataPort.pl (GUS BIR 1.1).
 * https://dataport.pl/api/reference
 */
import type { NipCompanyLookupResultDto } from '@lama-stage/shared-types'
import { AppError } from '../../shared/errors/AppError'
const MF_WL_BASE = 'https://wl-api.mf.gov.pl'

function normalizeNipInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10)
}

function normalizeAddress(s: string): string {
  return s
    .trim()
    .replace(/^ul\/\s*/i, 'ul. ')
    .replace(/\s+/g, ' ')
}

/** Data w strefie Europe/Warsaw jako YYYY-MM-DD (wymagany parametr `date` w API MF). */
function todayDateWarsaw(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
}

type JsonRecord = Record<string, unknown>

function asRecord(v: unknown): JsonRecord | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonRecord) : null
}

function firstString(rec: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const v = rec[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function pickPayload(root: JsonRecord): JsonRecord {
  const candidateKeys = ['data', 'result', 'company', 'subject', 'firma']
  for (const k of candidateKeys) {
    const nested = asRecord(root[k])
    if (nested) return nested
  }
  return root
}

function addressFromComponents(rec: JsonRecord): string {
  const street = firstString(rec, ['ulica', 'street', 'ul', 'adres_ulica', 'adresUlica'])
  const building = firstString(rec, [
    'numer_budynku',
    'nr_budynku',
    'house_number',
    'nrNieruchomosci',
    'numerNieruchomosci',
  ])
  const flat = firstString(rec, ['numer_lokalu', 'nr_lokalu', 'apartment_number', 'nrLokalu', 'numerLokalu'])
  const postal = firstString(rec, ['kod_pocztowy', 'kodPocztowy', 'post_code', 'postal_code', 'zip', 'kod'])
  const city = firstString(rec, ['miasto', 'miejscowosc', 'city'])

  const streetParts = [street, building].filter(Boolean).join(' ').trim()
  const loc = flat ? `lok. ${flat}` : ''
  const line1 = [streetParts, loc].filter(Boolean).join(', ')
  const line2 = [postal, city].filter(Boolean).join(' ').trim()
  return normalizeAddress([line1, line2].filter(Boolean).join(', '))
}

function extractAddress(rec: JsonRecord): string {
  const direct = firstString(rec, ['adres', 'address', 'pelny_adres', 'full_address'])
  if (direct) return normalizeAddress(direct)

  const addressObj = asRecord(rec.adres) ?? asRecord(rec.address)
  if (addressObj) {
    const nestedDirect = firstString(addressObj, ['full', 'text', 'value', 'adres', 'address'])
    if (nestedDirect) return normalizeAddress(nestedDirect)
    const nestedBuilt = addressFromComponents(addressObj)
    if (nestedBuilt) return nestedBuilt
  }

  return addressFromComponents(rec)
}

type MfSubject = {
  workingAddress?: string
  residenceAddress?: string
}

type MfSearchNipResponse = {
  result?: {
    subject?: MfSubject | null
  }
}

async function tryFetchAddressFromMf(nip: string): Promise<string> {
  const date = todayDateWarsaw()
  const url = `${MF_WL_BASE}/api/search/nip/${encodeURIComponent(nip)}?date=${encodeURIComponent(date)}`

  const headers: Record<string, string> = { Accept: 'application/json' }
  const bearer = process.env.MF_VAT_WL_API_KEY?.trim()
  if (bearer) headers.Authorization = `Bearer ${bearer}`

  let res: Response
  try {
    res = await fetch(url, { method: 'GET', headers })
  } catch {
    return ''
  }

  if (!res.ok) return ''

  let parsed: unknown
  try {
    parsed = (await res.json()) as unknown
  } catch {
    return ''
  }

  const data = parsed as MfSearchNipResponse
  const addrRaw = data?.result?.subject?.workingAddress || data?.result?.subject?.residenceAddress || ''
  return normalizeAddress(addrRaw)
}

function mapHttpStatusToAppError(status: number, body: JsonRecord, fallback: string): AppError {
  const msg =
    firstString(body, ['message', 'komunikat', 'error_description', 'description']) ||
    fallback
  const errorCode = firstString(body, ['error', 'code']) || 'DATAPORT_CLIENT'
  if (status === 401) return new AppError('Nieprawidłowy klucz API DataPort.', 502, 'DATAPORT_AUTH')
  if (status === 404) return new AppError(msg, 404, 'DATAPORT_NOT_FOUND')
  if (status === 429) return new AppError(msg, 429, 'DATAPORT_RATE_LIMIT')
  if (status >= 400 && status < 500) return new AppError(msg, status, errorCode)
  return new AppError(msg, 502, 'DATAPORT_HTTP')
}

export async function lookupCompanyByNipFromDataport(nipRaw: string): Promise<NipCompanyLookupResultDto> {
  const apiKey = process.env.DATAPORT_API_KEY?.trim()
  if (!apiKey) {
    throw new AppError(
      'Brak klucza DataPort: ustaw DATAPORT_API_KEY w konfiguracji serwera.',
      503,
      'DATAPORT_NOT_CONFIGURED'
    )
  }

  const nip = normalizeNipInput(nipRaw)
  if (nip.length !== 10) {
    throw new AppError('Podaj poprawny NIP (10 cyfr).', 400, 'INVALID_NIP')
  }

  const baseRaw = process.env.DATAPORT_API_BASE_URL?.trim() || 'https://dataport.pl/api'
  const base = baseRaw.replace(/\/$/, '')

  async function fetchDataport(format: 'simple' | 'full', key: string): Promise<JsonRecord> {
    const url = `${base}/v1/company/${encodeURIComponent(nip)}?format=${format}`
    let res: Response
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': key,
          Accept: 'application/json',
        },
      })
    } catch (e) {
      const m = e instanceof Error ? e.message : 'fetch failed'
      throw new AppError(`Błąd połączenia z DataPort: ${m}`, 502, 'DATAPORT_NETWORK')
    }

    const text = await res.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      throw new AppError('Nieprawidłowa odpowiedź DataPort.', 502, 'DATAPORT_PARSE')
    }
    const root = asRecord(parsed)
    if (!root) {
      throw new AppError('Nieprawidłowy format odpowiedzi DataPort.', 502, 'DATAPORT_PARSE')
    }
    const payload = pickPayload(root)
    const merged: JsonRecord = { ...root, ...payload }

    if (!res.ok) {
      throw mapHttpStatusToAppError(res.status, merged, text.slice(0, 200))
    }
    if (merged.success === false) {
      const code = firstString(merged, ['error']) === 'RATE_LIMIT_EXCEEDED' ? 429 : 404
      const msg = firstString(merged, ['message', 'komunikat']) || 'DataPort: żądanie nie powiodło się.'
      const err = firstString(merged, ['error', 'code']) || 'DATAPORT_ERROR'
      throw new AppError(msg, code, err)
    }

    return merged
  }

  let data = await fetchDataport('simple', apiKey)
  let address = extractAddress(data)
  if (!address) {
    data = await fetchDataport('full', apiKey)
    address = extractAddress(data)
  }
  if (!address) {
    // DataPort dla części JDG potrafi zwrócić nazwę bez adresu; dociągamy sam adres z MF.
    address = await tryFetchAddressFromMf(nip)
  }

  const name = firstString(data, ['nazwa', 'name', 'firma', 'companyName'])
  if (!name) {
    throw new AppError('Brak nazwy firmy w odpowiedzi DataPort.', 502, 'DATAPORT_INCOMPLETE')
  }
  if (!address) {
    throw new AppError('Brak adresu w odpowiedzi DataPort i MF.', 502, 'DATAPORT_INCOMPLETE')
  }

  const out: NipCompanyLookupResultDto = {
    companyName: name,
    address,
    nip: normalizeNipInput(firstString(data, ['nip', 'NIP']) || nip),
  }
  const regon = firstString(data, ['regon', 'REGON'])
  if (regon) {
    out.regon = regon
  }
  return out
}
