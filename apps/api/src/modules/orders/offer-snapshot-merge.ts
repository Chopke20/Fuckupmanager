import type { Prisma, PrismaClient } from '@prisma/client'
import { z } from 'zod'
import {
  OfferDocumentDraftSchema,
  OrderOfferSnapshotSchema,
  type OfferDocumentDraft,
  type OrderOfferSnapshot,
} from '@lama-stage/shared-types'
import type { OrderLike } from '../pdf/offer-v5-builder'
import { buildOfferDefaultDraft, parseJsonSafely } from './order-document-draft-utils'

function sortKeysDeep(val: unknown): unknown {
  if (val === null || typeof val !== 'object') return val
  if (Array.isArray(val)) return val.map(sortKeysDeep)
  const o = val as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(o).sort()) {
    out[k] = sortKeysDeep(o[k])
  }
  return out
}

/**
 * Porównanie treści oferty bez metadanych czasu/numeru — jeśli równe, nie nadajemy nowej wersji
 * (ponowne wystawienie z tą samą treścią, zmienia się tylko data w nagłówku PDF).
 */
export function stripOfferSnapshotMetaForCompare(snapshot: Record<string, unknown>): unknown {
  const clone = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>
  delete clone.generatedAt
  delete clone.documentNumber
  if (clone.documentDraft && typeof clone.documentDraft === 'object' && clone.documentDraft !== null) {
    const dd = { ...(clone.documentDraft as Record<string, unknown>) }
    delete dd.issuedAt
    clone.documentDraft = dd
  }
  return sortKeysDeep(clone)
}

export function areOfferSnapshotContentsEqual(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  const sa = stripOfferSnapshotMetaForCompare(a as Record<string, unknown>)
  const sb = stripOfferSnapshotMetaForCompare(b as Record<string, unknown>)
  return JSON.stringify(sa) === JSON.stringify(sb)
}

/** Zgodne z `loadOrderForPdf` / eksportem oferty — pełne dane zlecenia do snapshotu i PDF. */
export type OrderForOfferPipeline = Prisma.OrderGetPayload<{
  include: {
    client: true
    stages: { orderBy: { sortOrder: 'asc' } }
    equipmentItems: {
      include: { equipment: true }
      orderBy: { sortOrder: 'asc' }
    }
    productionItems: {
      where: { visibleInOffer: true }
      orderBy: { sortOrder: 'asc' }
    }
  }
}>

export async function loadOfferDraftPayload(
  db: Pick<PrismaClient, 'orderDocumentDraft' | 'issuerProfile'>,
  orderId: string,
  order: OrderForOfferPipeline
): Promise<OfferDocumentDraft> {
  const draft = await db.orderDocumentDraft.findUnique({
    where: {
      orderId_documentType: {
        orderId,
        documentType: 'OFFER',
      },
    },
  })
  const parsed = parseJsonSafely(draft?.payload ?? null)
  if (parsed != null) {
    return OfferDocumentDraftSchema.parse(parsed)
  }
  return buildOfferDefaultDraft(db, order)
}

/** Prisma zwraca `null` w polach opcjonalnych; Zod `.optional()` akceptuje tylko `undefined` — inaczej parse() rzuca i API zwraca 500. */
function nilStr(v: string | null | undefined): string | undefined {
  if (v == null) return undefined
  const t = String(v).trim()
  return t === '' ? undefined : t
}

function clientEmailForSnapshot(v: string | null | undefined): string {
  if (v == null) return ''
  const t = String(v).trim()
  if (t === '') return ''
  return z.string().email().safeParse(t).success ? t : ''
}

function normalizePricingRuleFromJson(
  v: unknown
): { day1: number; nextDays: number } | undefined {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return undefined
  const o = v as Record<string, unknown>
  const day1 = o.day1
  const nextDays = o.nextDays
  if (typeof day1 === 'number' && typeof nextDays === 'number') {
    return { day1, nextDays }
  }
  return undefined
}

function normalizeClientForSnapshot(client: NonNullable<OrderForOfferPipeline['client']>) {
  return {
    id: client.id,
    companyName: client.companyName,
    contactName: nilStr(client.contactName),
    address: nilStr(client.address),
    nip: nilStr(client.nip),
    email: clientEmailForSnapshot(client.email),
    phone: nilStr(client.phone),
    notes: nilStr(client.notes),
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  }
}

function normalizeStagesForSnapshot(stages: OrderForOfferPipeline['stages']) {
  return stages.map((s: OrderForOfferPipeline['stages'][number]) => ({
    id: s.id,
    orderId: s.orderId,
    type: s.type,
    label: nilStr(s.label),
    date: s.date.toISOString(),
    timeStart: nilStr(s.timeStart),
    timeEnd: nilStr(s.timeEnd),
    notes: nilStr(s.notes),
    sortOrder: s.sortOrder,
    createdAt: s.createdAt.toISOString(),
  }))
}

type EquipmentRow = OrderForOfferPipeline['equipmentItems'][number]
type EquipmentLink = NonNullable<EquipmentRow['equipment']>

function sanitizeEquipmentForSnapshot(eq: EquipmentLink) {
  const urlRaw = eq.imageUrl
  let imageUrl = ''
  if (urlRaw != null && String(urlRaw).trim() !== '') {
    const u = String(urlRaw).trim()
    imageUrl = z.string().url().safeParse(u).success ? u : ''
  }
  return {
    id: eq.id,
    name: eq.name,
    description: nilStr(eq.description),
    category: eq.category ?? 'Inne',
    subcategory: nilStr(eq.subcategory),
    dailyPrice: eq.dailyPrice,
    stockQuantity: eq.stockQuantity,
    unit: eq.unit ?? 'szt.',
    internalCode: nilStr(eq.internalCode),
    technicalNotes: nilStr(eq.technicalNotes),
    imageUrl,
    visibleInOffer: eq.visibleInOffer ?? true,
    pricingRule: normalizePricingRuleFromJson(eq.pricingRule),
    createdAt: eq.createdAt.toISOString(),
    updatedAt: eq.updatedAt.toISOString(),
  }
}

function normalizeEquipmentForSnapshot(items: OrderForOfferPipeline['equipmentItems']) {
  return items.map((e: EquipmentRow) => ({
    id: e.id,
    orderId: e.orderId,
    equipmentId: e.equipmentId ?? undefined,
    equipment: e.equipment ? sanitizeEquipmentForSnapshot(e.equipment) : undefined,
    name: e.name,
    description: nilStr(e.description),
    category: e.category ?? 'Inne',
    quantity: e.quantity,
    unitPrice: e.unitPrice,
    days: e.days ?? 1,
    discount: e.discount ?? 0,
    pricingRule: normalizePricingRuleFromJson(e.pricingRule),
    visibleInOffer: e.visibleInOffer ?? true,
    isRental: e.isRental ?? false,
    sortOrder: e.sortOrder ?? 0,
    dateFrom: e.dateFrom ? e.dateFrom.toISOString() : undefined,
    dateTo: e.dateTo ? e.dateTo.toISOString() : undefined,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }))
}

function normalizeProductionForSnapshot(items: OrderForOfferPipeline['productionItems']) {
  return items.map((p: OrderForOfferPipeline['productionItems'][number]) => ({
    id: p.id,
    orderId: p.orderId,
    name: p.name,
    description: nilStr(p.description),
    rateType: p.rateType,
    rateValue: p.rateValue,
    units: p.units,
    discount: p.discount ?? 0,
    stageIds: nilStr(p.stageIds),
    isTransport: p.isTransport ?? false,
    isAutoCalculated: p.isAutoCalculated ?? true,
    isSubcontractor: p.isSubcontractor ?? false,
    visibleInOffer: p.visibleInOffer ?? true,
    sortOrder: p.sortOrder ?? 0,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))
}

/**
 * Snapshot oferty = bieżące dane zlecenia + ustawienia dokumentu z draftu (lub domyślne).
 * `documentDraft` w snapshotcie jest „zamrożony” z `issuedAt` = moment generacji (PDF / eksport).
 */
export function buildOrderOfferSnapshotFromOrder(
  order: OrderForOfferPipeline,
  draft: OfferDocumentDraft,
  meta: { generatedAt: string; documentNumber: string }
) {
  if (!order.client) {
    throw new Error('Zlecenie bez klienta — brak danych do oferty')
  }

  const orderYear = order.orderYear ?? new Date(order.createdAt).getFullYear()
  const orderNumber = order.orderNumber

  const frozenDraft = {
    ...draft,
    issuedAt: meta.generatedAt,
  }

  return OrderOfferSnapshotSchema.parse({
    orderId: order.id,
    name: order.name,
    description: order.description ?? undefined,
    notes: order.notes ?? undefined,
    status: order.status,
    venue: order.venue ?? undefined,
    venuePlaceId: order.venuePlaceId ?? undefined,
    startDate: order.startDate.toISOString(),
    endDate: order.endDate.toISOString(),
    client: normalizeClientForSnapshot(order.client),
    discountGlobal: order.discountGlobal,
    vatRate: draft.vatRate,
    orderYear,
    orderNumber,
    offerValidityDays: draft.offerValidityDays,
    projectContactKey: draft.projectContactKey ?? null,
    currency: draft.currency,
    exchangeRateEur: draft.exchangeRateEur ?? null,
    isRecurring: order.isRecurring,
    recurringConfig: order.recurringConfig ?? undefined,
    stages: normalizeStagesForSnapshot(order.stages),
    equipmentItems: normalizeEquipmentForSnapshot(order.equipmentItems),
    productionItems: normalizeProductionForSnapshot(order.productionItems),
    documentDraft: frozenDraft as Record<string, unknown>,
    generatedAt: meta.generatedAt,
    documentNumber: meta.documentNumber,
  })
}

function pdfDescriptionForOffer(snapshot: OrderOfferSnapshot): string | null {
  const draftRaw = snapshot.documentDraft
  if (draftRaw && typeof draftRaw === 'object' && draftRaw !== null) {
    if (Object.prototype.hasOwnProperty.call(draftRaw, 'clientOfferDescription')) {
      const v = (draftRaw as { clientOfferDescription?: unknown }).clientOfferDescription
      return typeof v === 'string' ? v.trim() : ''
    }
  }
  const d = snapshot.description
  if (d == null) return null
  const t = String(d).trim()
  return t === '' ? null : t
}

export function orderOfferSnapshotToPdfOrderLike(snapshot: OrderOfferSnapshot): OrderLike {
  const draftRaw = snapshot.documentDraft
  let offerIssuer: OrderLike['offerIssuer']
  if (draftRaw && typeof draftRaw === 'object' && draftRaw !== null && 'issuer' in draftRaw) {
    const iss = (draftRaw as { issuer?: Record<string, unknown> }).issuer
    if (iss && typeof iss === 'object' && iss.companyName && iss.nip && iss.address && iss.email) {
      offerIssuer = {
        companyName: String(iss.companyName),
        nip: String(iss.nip),
        address: String(iss.address),
        email: String(iss.email),
        phone: iss.phone != null ? String(iss.phone) : undefined,
      }
    }
  }

  return {
    name: snapshot.name as string,
    description: pdfDescriptionForOffer(snapshot),
    offerValidityDays: snapshot.offerValidityDays as number,
    currency: snapshot.currency as string | null,
    exchangeRateEur: snapshot.exchangeRateEur as number | null | undefined,
    vatRate: snapshot.vatRate as number | null,
    discountGlobal: snapshot.discountGlobal as number | null,
    isRecurring: snapshot.isRecurring as boolean | null | undefined,
    recurringConfig: snapshot.recurringConfig as string | null | undefined,
    projectContactKey: snapshot.projectContactKey as string | null | undefined,
    client: snapshot.client as OrderLike['client'],
    stages: snapshot.stages as OrderLike['stages'],
    equipmentItems: snapshot.equipmentItems as OrderLike['equipmentItems'],
    productionItems: snapshot.productionItems as OrderLike['productionItems'],
    offerIssuer,
  }
}
