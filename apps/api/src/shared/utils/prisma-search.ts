import type { Prisma, PrismaClient } from '@prisma/client'

/** PostgreSQL: case-insensitive fragment match (ILIKE). */
export function prismaContainsInsensitive(value: string): { contains: string; mode: 'insensitive' } {
  return { contains: value, mode: 'insensitive' }
}

/**
 * NFC + NFD variants so Polish diacritics (ę, ą, …) match whether the DB
 * or the typed query uses precomposed or combining-mark forms.
 */
export function searchTermVariants(raw: string): string[] {
  const trimmed = raw.trim()
  if (!trimmed) return []
  const nfc = trimmed.normalize('NFC')
  const nfd = trimmed.normalize('NFD')
  return nfc === nfd ? [nfc] : [nfc, nfd]
}

/** Polish diacritics → ASCII for accent-insensitive LIKE (both sides). */
const PL_FROM = 'ąćęłńóśźż'
const PL_TO = 'acelnoszz'

export function foldPolishSearchTerm(raw: string): string {
  const lower = raw.normalize('NFC').trim().toLowerCase()
  let out = ''
  for (const ch of lower) {
    const i = PL_FROM.indexOf(ch)
    out += i >= 0 ? PL_TO[i]! : ch
  }
  // Strip LIKE wildcards from user input (we wrap with % ourselves).
  return out.replace(/[%_]/g, '')
}

export function equipmentListSearchWhere(term: string): Prisma.EquipmentWhereInput {
  const contains = prismaContainsInsensitive(term)
  return {
    OR: [
      { name: contains },
      { description: contains },
      { internalCode: contains },
      { subcategory: contains },
      { category: contains },
    ],
  }
}

/** Fallback Prisma OR when raw Polish fold query is unavailable. */
export function orderListSearchWhere(term: string): Prisma.OrderWhereInput {
  const variants = searchTermVariants(term)
  const or: Prisma.OrderWhereInput[] = []

  for (const v of variants) {
    const contains = prismaContainsInsensitive(v)
    or.push(
      { name: contains },
      { venue: contains },
      { description: contains },
      { client: { companyName: contains } },
      { client: { contactName: contains } },
    )
  }

  const digits = term.replace(/\D/g, '')
  if (digits.length > 0 && digits.length <= 6) {
    const n = Number.parseInt(digits, 10)
    if (Number.isFinite(n) && n > 0) {
      or.push({ orderNumber: n })
    }
  }

  const ordRef = term.trim().match(/^ord-?(\d{2})-?(\d{1,4})$/i)
  if (ordRef?.[1] && ordRef[2]) {
    const yy = Number.parseInt(ordRef[1], 10)
    const num = Number.parseInt(ordRef[2], 10)
    if (Number.isFinite(yy) && Number.isFinite(num) && num > 0) {
      or.push({ orderYear: 2000 + yy, orderNumber: num })
    }
  }

  return { OR: or }
}

type PrismaQueryable = Pick<PrismaClient, '$queryRaw'>

/**
 * Accent- and case-insensitive order ID match (name, venue, description, client, order no.).
 * Uses PostgreSQL normalize(NFC) + translate for Polish diacritics.
 */
export async function findOrderIdsForSearch(db: PrismaQueryable, term: string): Promise<string[]> {
  const folded = foldPolishSearchTerm(term)
  if (!folded) return []

  const pattern = `%${folded}%`

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT o.id
    FROM orders o
    INNER JOIN clients c ON c.id = o."clientId"
    WHERE
      translate(lower(normalize(o.name, NFC)), ${PL_FROM}, ${PL_TO}) LIKE ${pattern}
      OR translate(lower(normalize(COALESCE(o.venue, ''), NFC)), ${PL_FROM}, ${PL_TO}) LIKE ${pattern}
      OR translate(lower(normalize(COALESCE(o.description, ''), NFC)), ${PL_FROM}, ${PL_TO}) LIKE ${pattern}
      OR translate(lower(normalize(c."companyName", NFC)), ${PL_FROM}, ${PL_TO}) LIKE ${pattern}
      OR translate(lower(normalize(COALESCE(c."contactName", ''), NFC)), ${PL_FROM}, ${PL_TO}) LIKE ${pattern}
      OR (
        o."orderNumber" IS NOT NULL
        AND (
          CAST(o."orderNumber" AS TEXT) LIKE ${pattern}
          OR lower(
            'ord-'
            || right(CAST(COALESCE(o."orderYear", 0) AS TEXT), 2)
            || '-'
            || lpad(CAST(o."orderNumber" AS TEXT), 4, '0')
          ) LIKE ${pattern}
        )
      )
  `

  return rows.map((r) => r.id)
}

/** Clients list / global search — case-insensitive + NFC/NFD variants. */
export function clientListSearchWhere(term: string): Prisma.ClientWhereInput {
  const variants = searchTermVariants(term)
  const or: Prisma.ClientWhereInput[] = []

  for (const v of variants) {
    const contains = prismaContainsInsensitive(v)
    or.push(
      { companyName: contains },
      { contactName: contains },
      { email: contains },
      { phone: contains },
      { nip: contains },
      { address: contains },
    )
  }

  return { OR: or }
}

export async function findClientIdsForSearch(db: PrismaQueryable, term: string): Promise<string[]> {
  const folded = foldPolishSearchTerm(term)
  if (!folded) return []

  const pattern = `%${folded}%`

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT c.id
    FROM clients c
    WHERE
      translate(lower(normalize(c."companyName", NFC)), ${PL_FROM}, ${PL_TO}) LIKE ${pattern}
      OR translate(lower(normalize(COALESCE(c."contactName", ''), NFC)), ${PL_FROM}, ${PL_TO}) LIKE ${pattern}
      OR translate(lower(normalize(COALESCE(c.email, ''), NFC)), ${PL_FROM}, ${PL_TO}) LIKE ${pattern}
      OR translate(lower(normalize(COALESCE(c.phone, ''), NFC)), ${PL_FROM}, ${PL_TO}) LIKE ${pattern}
      OR translate(lower(normalize(COALESCE(c.nip, ''), NFC)), ${PL_FROM}, ${PL_TO}) LIKE ${pattern}
      OR translate(lower(normalize(COALESCE(c.address, ''), NFC)), ${PL_FROM}, ${PL_TO}) LIKE ${pattern}
  `

  return rows.map((r) => r.id)
}
