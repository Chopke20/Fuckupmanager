import type { Client, Equipment, Order, OrderEquipmentItem } from '@prisma/client'
import { WarehouseDocumentDraftSchema, WarehouseSnapshotSchema } from '@lama-stage/shared-types'

type EquipmentItemWithEq = OrderEquipmentItem & { equipment: Equipment | null }

export type OrderForWarehouseSnapshot = Order & {
  client: Client
  equipmentItems: EquipmentItemWithEq[]
}

function normalizeClient(client: Client) {
  return {
    ...client,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    deletedAt: client.deletedAt ? client.deletedAt.toISOString() : null,
  }
}

function normalizeEquipmentItems(items: EquipmentItemWithEq[]) {
  return items.map((e) => ({
    ...e,
    dateFrom: e.dateFrom ? e.dateFrom.toISOString() : undefined,
    dateTo: e.dateTo ? e.dateTo.toISOString() : undefined,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    equipment: e.equipment
      ? {
          ...e.equipment,
          createdAt: e.equipment.createdAt.toISOString(),
          updatedAt: e.equipment.updatedAt.toISOString(),
          deletedAt: e.equipment.deletedAt ? e.equipment.deletedAt.toISOString() : null,
        }
      : undefined,
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
  generatedAt: string
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
    notes: parsedDraft.notes ?? undefined,
    generatedAt,
    client: normalizeClient(order.client),
    venue: order.venue ?? undefined,
    venuePlaceId: order.venuePlaceId ?? undefined,
    startDate: order.startDate.toISOString(),
    endDate: order.endDate.toISOString(),
    equipmentItems: normalizeEquipmentItems(order.equipmentItems),
    itemLoadChecked: parsedDraft.checked,
  })
}
