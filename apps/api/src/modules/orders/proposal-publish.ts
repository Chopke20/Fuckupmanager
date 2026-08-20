import { randomBytes } from 'node:crypto'
import {
  OfferDocumentDraftSchema,
  ProposalClientSignalsSchema,
  ProposalDocumentDraftSchema,
  type ProposalClientSignals,
  type ProposalDocumentDraft,
} from '@lama-stage/shared-types'
import { prisma } from '../../prisma/client'
import { AppError } from '../../shared/errors/AppError'
import { getCompanyRegistry } from '../companies/company-registry'
import { getCurrentCompanyCode, runWithCompanyContext } from '../../shared/context/company-context'
import { buildDocumentNumber, parseJsonSafely } from './order-document-draft-utils'
import {
  buildProposalPublicSnapshot,
  parseProposalDraft,
  readIssuerFromOfferSnapshot,
  readOfferValidityDaysFromSnapshot,
  validateProposalOptionsAgainstOrder,
  type ProposalPublicSnapshot,
} from './proposal-snapshot'

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/

export function isValidProposalPublicToken(token: string): boolean {
  return TOKEN_RE.test(token)
}

function newPublicToken(): string {
  return randomBytes(24).toString('base64url')
}

function pickLogoUrl(settings: {
  logoDarkBgUrl?: string | null
  logoLightBgUrl?: string | null
  documentsLogoVariant?: string | null
  loginLogoVariant?: string | null
}): string | null {
  const dark = settings.logoDarkBgUrl?.trim() || null
  const light = settings.logoLightBgUrl?.trim() || null
  const variant = settings.documentsLogoVariant ?? settings.loginLogoVariant
  if (variant === 'LIGHT') return light ?? dark
  return dark ?? light
}

function pickContact(
  settings: { projectContactsJson?: string | null; defaultProjectContactId?: string | null },
  preferredId?: string | null
): { name: string | null; phone: string | null; email: string | null } {
  const raw = settings.projectContactsJson
  if (!raw?.trim()) return { name: null, phone: null, email: null }
  let list: Array<{ id?: unknown; name?: unknown; phone?: unknown; email?: unknown }> = []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) list = parsed
  } catch {
    return { name: null, phone: null, email: null }
  }
  const pick =
    (preferredId ? list.find((c) => String(c.id ?? '') === preferredId) : null) ??
    (settings.defaultProjectContactId
      ? list.find((c) => String(c.id ?? '') === settings.defaultProjectContactId)
      : null) ??
    list[0] ??
    null
  if (!pick) return { name: null, phone: null, email: null }
  return {
    name: typeof pick.name === 'string' ? pick.name : null,
    phone: typeof pick.phone === 'string' ? pick.phone : null,
    email: typeof pick.email === 'string' ? pick.email : null,
  }
}

export function parseClientSignals(raw: string | null | undefined): ProposalClientSignals {
  const parsed = parseJsonSafely(raw ?? null)
  const result = ProposalClientSignalsSchema.safeParse(parsed ?? {})
  return result.success ? result.data : { interestedOptionIds: [], discussRequestedAt: null }
}

export async function findProposalExportByPublicToken(token: string) {
  if (!isValidProposalPublicToken(token)) return null
  const companies = getCompanyRegistry()
  for (const company of companies) {
    const found = await runWithCompanyContext(company.code, async () =>
      prisma.orderDocumentExport.findFirst({
        where: { documentType: 'PROPOSAL', publicToken: token },
      })
    )
    if (found) return { companyCode: company.code, export: found }
  }
  return null
}

export async function publishProposalExport(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: true,
      offerBlocks: { orderBy: { sortOrder: 'asc' } },
      equipmentItems: { orderBy: { sortOrder: 'asc' } },
      productionItems: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!order) throw new AppError('Zlecenie nie zostało znalezione', 404, 'NOT_FOUND')
  if (!order.client) throw new AppError('Zlecenie nie ma przypisanego klienta.', 400)
  const orderYear = order.orderYear ?? new Date(order.createdAt).getFullYear()
  const orderNumber = order.orderNumber
  if (orderNumber == null || orderYear == null) {
    throw new AppError('Zlecenie nie ma nadanego numeru.', 400)
  }

  const draftRecord = await prisma.orderDocumentDraft.findUnique({
    where: { orderId_documentType: { orderId, documentType: 'PROPOSAL' } },
  })
  const draft = parseProposalDraft(parseJsonSafely(draftRecord?.payload ?? null))
  const parsedDraft = ProposalDocumentDraftSchema.safeParse(draft)
  if (!parsedDraft.success) {
    throw new AppError('Nieprawidłowy draft proposal.', 400, 'VALIDATION_ERROR', parsedDraft.error.flatten())
  }
  const proposalDraft: ProposalDocumentDraft = parsedDraft.data
  if (!proposalDraft.offerExportId) {
    throw new AppError('Najpierw wygeneruj Ofertę PDF i wskaż jej snapshot w proposal.', 400)
  }

  const offerExport = await prisma.orderDocumentExport.findFirst({
    where: { id: proposalDraft.offerExportId, orderId, documentType: 'OFFER' },
  })
  if (!offerExport) {
    throw new AppError('Wybrany snapshot Oferty nie istnieje w tym zleceniu.', 400)
  }

  const optionError = validateProposalOptionsAgainstOrder({
    options: proposalDraft.options,
    blocks: order.offerBlocks,
    equipment: order.equipmentItems,
    production: order.productionItems,
  })
  if (optionError) throw new AppError(optionError, 400)

  let offerSnapshotRaw: unknown = null
  try {
    offerSnapshotRaw = JSON.parse(offerExport.snapshot)
  } catch {
    throw new AppError('Nie udało się odczytać snapshotu Oferty.', 500)
  }
  const validityDays = readOfferValidityDaysFromSnapshot(offerSnapshotRaw, order.offerValidityDays ?? 14)
  const issuer =
    readIssuerFromOfferSnapshot(offerSnapshotRaw) ?? {
      companyName: 'Firma',
      email: '',
      phone: '',
    }

  const appSettings = await prisma.appSettings.findUnique({ where: { id: 1 } }).catch(() => null)
  const offerDraftParsed = OfferDocumentDraftSchema.safeParse(
    offerSnapshotRaw && typeof offerSnapshotRaw === 'object'
      ? (offerSnapshotRaw as { documentDraft?: unknown }).documentDraft
      : null
  )
  const preferredContactId = offerDraftParsed.success ? offerDraftParsed.data.projectContactId ?? null : null
  const contact = pickContact(appSettings ?? {}, preferredContactId)
  const companyCode = getCurrentCompanyCode()
  const branding = {
    brandName: appSettings?.brandName?.trim() || 'Lama Stage',
    logoUrl: pickLogoUrl(appSettings ?? {}),
    primaryColorHex: appSettings?.primaryColorHex ?? null,
  }

  const generatedAt = new Date()
  const result = await prisma.$transaction(async (tx) => {
    const existingCount = await tx.orderDocumentExport.count({
      where: { orderId, documentType: 'PROPOSAL' },
    })
    const version = existingCount + 1
    const documentNumber = buildDocumentNumber({
      documentType: 'PROPOSAL',
      orderNumber,
      orderYear,
      version,
    })
    const snapshot = buildProposalPublicSnapshot({
      documentNumber,
      generatedAt: generatedAt.toISOString(),
      validityDays,
      order: {
        name: order.name,
        venue: order.venue,
        dateFrom: order.dateFrom.toISOString(),
        dateTo: order.dateTo.toISOString(),
        clientCompanyName: order.client.companyName,
        discountGlobal: order.discountGlobal ?? 0,
        vatRate: order.vatRate ?? 23,
        currency: order.currency === 'EUR' ? 'EUR' : 'PLN',
      },
      draft: proposalDraft,
      blocks: order.offerBlocks,
      equipment: order.equipmentItems,
      production: order.productionItems,
      branding,
      issuer,
      contact,
      offer: { exportId: offerExport.id, documentNumber: offerExport.documentNumber },
    })
    let publicToken = newPublicToken()
    for (let i = 0; i < 5; i += 1) {
      const clash = await tx.orderDocumentExport.findFirst({ where: { publicToken } })
      if (!clash) break
      publicToken = newPublicToken()
    }
    const created = await tx.orderDocumentExport.create({
      data: {
        orderId,
        documentType: 'PROPOSAL',
        documentNumber,
        snapshot: JSON.stringify(snapshot),
        publicToken,
        expiresAt: new Date(snapshot.expiresAt),
        clientSignalsJson: JSON.stringify({ interestedOptionIds: [], discussRequestedAt: null }),
      },
    })
    return { created, snapshot, companyCode }
  })

  return result
}

export function snapshotFromExport(snapshotJson: string): ProposalPublicSnapshot | null {
  try {
    const raw = JSON.parse(snapshotJson) as unknown
    if (!raw || typeof raw !== 'object') return null
    const s = raw as Partial<ProposalPublicSnapshot>
    if (s.documentType !== 'PROPOSAL') return null
    return s as ProposalPublicSnapshot
  } catch {
    return null
  }
}
