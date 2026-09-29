import type { Client, Equipment, Order, OrderEquipmentItem } from '@prisma/client'
import { WarehouseDocumentDraftSchema, WarehouseSnapshotSchema } from '@lama-stage/shared-types'
import { z } from 'zod'

type EquipmentItemWithEq = OrderEquipmentItem & { equipment: Equipment | null }

export type OrderForWarehouseSnapshot = Order & {
  client: Client
  equipmentItems: EquipmentItemWithEq[]
}

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
  v: unknown,
): { day1: number; nextDays: number } | undefined {
  if (v == null) return undefined
  let raw: unknown = v
  if (typeof v === 'string') {
    try {
      raw = JSON.parse(v)
    } catch {
      return undefined
    }
  }
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const day1 = Number(o.day1)
  const nextDays = Number(o.nextDays)
  if (!Number.isFinite(day1) || !Number.isFinite(nextDays)) return undefined
  return { day1, nextDays }
}

function normalizeClient(client: Client) {
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

function sanitizeEquipment(eq: Equipment) {
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
    category: eq.category || 'Inne',
    subcategory: nilStr(eq.subcategory),
    dailyPrice: eq.dailyPrice,
    stockQuantity: eq.stockQuantity,
    unit: eq.unit || 'szt.',
    internalCode: nilStr(eq.internalCode),
    technicalNotes: nilStr(eq.technicalNotes),
    imageUrl,
    visibleInOffer: eq.visibleInOffer ?? true,
    pricingRule: normalizePricingRuleFromJson(eq.pricingRule),
    createdAt: eq.createdAt.toISOString(),
    updatedAt: eq.updatedAt.toISOString(),
  }
}

function normalizeEquipmentItems(items: EquipmentItemWithEq[]) {
  return items.map((e) => ({
    id: e.id,
    orderId: e.orderId,
    equipmentId: e.equipmentId ?? undefined,
    equipment: e.equipment ? sanitizeEquipment(e.equipment) : undefined,
    name: e.name,
    description: nilStr(e.description),
    category: e.category || 'Inne',
    quantity: e.quantity,
    unitPrice: e.unitPrice,
    days: e.days ?? 1,
    discount: e.discount ?? 0,
    pricingRule: normalizePricingRuleFromJson(e.pricingRule),
    visibleInOffer: e.visibleInOffer ?? true,
    isRental: e.isRental ?? false,
    externalConfirmationStatus: e.externalConfirmationStatus ?? undefined,
    externalConfirmationDeadline: e.externalConfirmationDeadline
      ? e.externalConfirmationDeadline.toISOString()
      : null,
    externalConfirmedAt: e.externalConfirmedAt ? e.externalConfirmedAt.toISOString() : null,
    sortOrder: e.sortOrder ?? 0,
    offerBlockId: e.offerBlockId ?? undefined,
    marginRentalUnits: e.marginRentalUnits ?? null,
    marginRentalUnitCostNet: e.marginRentalUnitCostNet ?? null,
    dateFrom: e.dateFrom ? e.dateFrom.toISOString() : undefined,
    dateTo: e.dateTo ? e.dateTo.toISOString() : undefined,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }))
}

export function stripWarehouseSnapshotMetaForCompare(snapshot: Record<string, unknown>): unknown {
  const clone = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>
  delete clone.generatedAt
  return clone
}

export function areWarehouseSnapshotContentsEqual(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false
  const sa = stripWarehouseSnapshotMetaForCompare(a as Record<string, unknown>)
  const sb = stripWarehouseSnapshotMetaForCompare(b as Record<string, unknown>)
  return JSON.stringify(sa) === JSON.stringify(sb)
}

export function buildWarehouseSnapshotFromOrder(
  order: OrderForWarehouseSnapshot,
  draftPayload: unknown,
  generatedAt: string,
) {
  const parsedDraft = WarehouseDocumentDraftSchema.parse(draftPayload)
  const orderYear = order.orderYear ?? new Date(order.createdAt).getFullYear()
  const orderNumber = order.orderNumber

  return WarehouseSnapshotSchema.parse({
    orderId: order.id,
    orderYear,
    orderNumber,
    documentType: 'WAREHOUSE',
    title: parsedDraft.title,
    notes: parsedDraft.notes || undefined,
    generatedAt,
    client: normalizeClient(order.client),
    venue: order.venue || undefined,
    venuePlaceId: order.venuePlaceId || undefined,
    startDate: order.startDate.toISOString(),
    endDate: order.endDate.toISOString(),
    equipmentItems: normalizeEquipmentItems(order.equipmentItems),
    itemLoadChecked: parsedDraft.checked,
    itemSkipPack: parsedDraft.skipPack,
    itemRental: parsedDraft.rental,
    itemNotes: parsedDraft.itemNotes,
  })
}
