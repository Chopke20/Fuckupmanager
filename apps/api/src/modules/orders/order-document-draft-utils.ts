import type { Order, PrismaClient } from '@prisma/client'
import {
  OfferDocumentDraftSchema,
  WarehouseDocumentDraftSchema,
  type DocumentType,
  type OfferDocumentDraft,
} from '@lama-stage/shared-types'

export { buildDocumentNumber } from '@lama-stage/shared-types'

export const DEFAULT_ISSUER_PROFILES = {
  DEFAULT_COMPANY: {
    profileKey: 'DEFAULT_COMPANY',
    companyName: process.env.DEFAULT_ISSUER_COMPANY_NAME ?? 'Twoja firma',
    address: process.env.DEFAULT_ISSUER_ADDRESS ?? 'Adres firmy',
    nip: process.env.DEFAULT_ISSUER_NIP ?? '0000000000',
    email: process.env.DEFAULT_ISSUER_EMAIL ?? 'kontakt@twojadomena.pl',
    phone: process.env.DEFAULT_ISSUER_PHONE ?? '',
  },
} as const

export function parseJsonSafely(value: string | null | undefined): unknown | null {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/** Domyślny wystawca z bazy (`isDefault`) — fallback do stałej Lamy gdy brak tabeli / rekordów. */
export async function resolveDefaultIssuerForDraft(
  db: Pick<PrismaClient, 'issuerProfile'>
): Promise<OfferDocumentDraft['issuer']> {
  const row =
    (await db.issuerProfile.findFirst({ where: { isDefault: true }, orderBy: { sortOrder: 'asc' } })) ??
    (await db.issuerProfile.findFirst({ orderBy: { sortOrder: 'asc' } }))
  if (row) {
    return {
      profileKey: row.profileKey,
      companyName: row.companyName,
      address: row.address,
      nip: row.nip,
      email: row.email,
      phone: row.phone ?? undefined,
    }
  }
  return { ...DEFAULT_ISSUER_PROFILES.DEFAULT_COMPANY }
}

type OrderOfferDraftFields = Pick<
  Order,
  'name' | 'offerValidityDays' | 'projectContactKey' | 'currency' | 'exchangeRateEur' | 'vatRate'
>

export async function buildOfferDefaultDraft(
  db: Pick<PrismaClient, 'issuerProfile'>,
  order: OrderOfferDraftFields
): Promise<OfferDocumentDraft> {
  const issuer = await resolveDefaultIssuerForDraft(db)
  return OfferDocumentDraftSchema.parse({
    offerValidityDays: order.offerValidityDays ?? 14,
    projectContactKey: order.projectContactKey ?? null,
    currency: order.currency ?? 'PLN',
    exchangeRateEur: order.exchangeRateEur ?? null,
    vatRate: order.vatRate === 0 ? 0 : 23,
    issuedAt: new Date().toISOString(),
    issuer,
  })
}

export function buildDefaultDraft(order: Pick<Order, 'name'>, documentType: DocumentType) {
  if (documentType === 'OFFER') {
    throw new Error('Użyj buildOfferDefaultDraft() dla OFFER — domyślny wystawca jest w bazie')
  }

  if (documentType === 'WAREHOUSE') {
    return WarehouseDocumentDraftSchema.parse({
      title: `Magazyn / załadunek - ${order.name}`,
      notes: '',
      checked: {},
    })
  }

  return {
    title: `${documentType} - ${order.name}`,
    notes: '',
  }
}
