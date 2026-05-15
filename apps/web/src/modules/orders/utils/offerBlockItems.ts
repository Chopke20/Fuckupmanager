import type { OrderEquipmentItem, OrderProductionItem } from '@lama-stage/shared-types'

export function filterEquipmentByBlock(
  items: Partial<OrderEquipmentItem>[],
  blockId: string | null,
): Partial<OrderEquipmentItem>[] {
  if (blockId === null) return items.filter((i) => !i.offerBlockId)
  return items.filter((i) => i.offerBlockId === blockId)
}

export function filterProductionByBlock(
  items: Partial<OrderProductionItem>[],
  blockId: string | null,
): Partial<OrderProductionItem>[] {
  if (blockId === null) return items.filter((i) => !i.isTransport && !i.offerBlockId)
  return items.filter((i) => !i.isTransport && i.offerBlockId === blockId)
}

export function mergeEquipmentForBlock(
  all: Partial<OrderEquipmentItem>[],
  blockId: string | null,
  blockItems: Partial<OrderEquipmentItem>[],
): Partial<OrderEquipmentItem>[] {
  const others =
    blockId === null
      ? all.filter((i) => !!i.offerBlockId)
      : all.filter((i) => i.offerBlockId !== blockId)
  const tagged = blockItems.map((i) => ({
    ...i,
    offerBlockId: blockId ?? null,
  }))
  return [...others, ...tagged]
}

export function mergeProductionForBlock(
  all: Partial<OrderProductionItem>[],
  blockId: string | null,
  blockItems: Partial<OrderProductionItem>[],
): Partial<OrderProductionItem>[] {
  const others =
    blockId === null
      ? all.filter((i) => i.isTransport || !!i.offerBlockId)
      : all.filter((i) => i.isTransport || i.offerBlockId !== blockId)
  const tagged = blockItems.map((i) => ({
    ...i,
    offerBlockId: blockId ?? null,
    isTransport: false,
  }))
  return [...others, ...tagged]
}
