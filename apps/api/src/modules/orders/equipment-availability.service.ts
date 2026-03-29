import { prisma } from '../../prisma/client'
import { AppError } from '../../shared/errors/AppError'

export type AvailabilitySourceOrder = {
  kind: 'ORDER'
  orderId: string
  orderName: string
  dateFrom: Date
  dateTo: Date
  quantity: number
}

export type AvailabilitySourceBlock = {
  kind: 'BLOCK'
  blockId: string
  note: string | null
  dateFrom: Date
  dateTo: Date
  quantity: number
}

export type AvailabilityDay = {
  date: string // YYYY-MM-DD (UTC key)
  reservedFromOrders: number
  reservedFromBlocks: number
  reservedTotal: number
  available: number
  sources: Array<AvailabilitySourceOrder | AvailabilitySourceBlock>
}

export type EquipmentAvailabilityDetailed = {
  equipmentId: string
  equipmentName: string
  stockQuantity: number
  requestedQuantity: number
  isAvailable: boolean
  summary: {
    maxReserved: number
    minAvailable: number
  }
  days: AvailabilityDay[]
  conflictingOrders: Array<{
    orderId: string
    orderName: string
    dateFrom: Date
    dateTo: Date
  }>
  conflictingBlocks: Array<{
    blockId: string
    note: string | null
    dateFrom: Date
    dateTo: Date
  }>
}

function toDayKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0))
}

function eachDayUtc(from: Date, to: Date): Date[] {
  const start = startOfDayUtc(from)
  const end = startOfDayUtc(to)
  const out: Date[] = []
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
    out.push(d)
  }
  return out
}

function overlaps(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date): boolean {
  return aFrom <= bTo && aTo >= bFrom
}

export async function calculateEquipmentAvailability(params: {
  equipmentIds: string[]
  dateFrom: Date
  dateTo: Date
  excludeOrderId?: string
  excludeBlockIds?: string[]
  requests?: Array<{ equipmentId: string; quantity: number }>
}): Promise<EquipmentAvailabilityDetailed[]> {
  const { equipmentIds, dateFrom, dateTo, excludeOrderId, excludeBlockIds, requests } = params
  if (!equipmentIds.length) return []
  if (!(dateFrom instanceof Date) || Number.isNaN(dateFrom.getTime())) {
    throw new AppError('dateFrom jest nieprawidłowe', 400, 'VALIDATION_ERROR')
  }
  if (!(dateTo instanceof Date) || Number.isNaN(dateTo.getTime())) {
    throw new AppError('dateTo jest nieprawidłowe', 400, 'VALIDATION_ERROR')
  }

  const equipment = await prisma.equipment.findMany({
    where: { id: { in: equipmentIds } },
    select: { id: true, name: true, stockQuantity: true },
  })
  const eqById = new Map(equipment.map((e) => [e.id, e]))

  const dayKeys = eachDayUtc(dateFrom, dateTo).map(toDayKeyUtc)

  const requestQtyByEquipmentId = new Map<string, number>()
  for (const req of requests ?? []) {
    if (!req?.equipmentId) continue
    const q = Number(req.quantity)
    if (!Number.isFinite(q) || q <= 0) continue
    requestQtyByEquipmentId.set(req.equipmentId, Math.floor(q))
  }

  // Orders occupying equipment in range (quantity-aware)
  const orders = await prisma.order.findMany({
    where: {
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
      isDeleted: false,
      status: { notIn: ['CANCELLED', 'ARCHIVED'] },
      dateFrom: { lte: dateTo },
      dateTo: { gte: dateFrom },
      equipmentItems: {
        some: {
          equipmentId: { in: equipmentIds },
        },
      },
    },
    select: {
      id: true,
      name: true,
      dateFrom: true,
      dateTo: true,
      equipmentItems: {
        where: {
          equipmentId: { in: equipmentIds },
        },
        select: {
          id: true,
          equipmentId: true,
          quantity: true,
          dateFrom: true,
          dateTo: true,
        },
      },
    },
  })

  // Calendar rentals/blocks
  const blocks = await prisma.equipmentBlock.findMany({
    where: {
      equipmentId: { in: equipmentIds },
      ...(excludeBlockIds && excludeBlockIds.length > 0 ? { id: { notIn: excludeBlockIds } } : {}),
      OR: [{ dateFrom: { lte: dateTo }, dateTo: { gte: dateFrom } }],
    },
    select: {
      id: true,
      equipmentId: true,
      quantity: true,
      dateFrom: true,
      dateTo: true,
      note: true,
    },
  })

  // Prepare per-equipment per-day maps
  const perEqDay = new Map<string, Map<string, AvailabilityDay>>()
  const ensureDay = (equipmentId: string, dayKey: string): AvailabilityDay => {
    let dayMap = perEqDay.get(equipmentId)
    if (!dayMap) {
      dayMap = new Map()
      perEqDay.set(equipmentId, dayMap)
    }
    let d = dayMap.get(dayKey)
    if (!d) {
      const stockQuantity = eqById.get(equipmentId)?.stockQuantity ?? 0
      d = {
        date: dayKey,
        reservedFromOrders: 0,
        reservedFromBlocks: 0,
        reservedTotal: 0,
        available: stockQuantity,
        sources: [],
      }
      dayMap.set(dayKey, d)
    }
    return d
  }

  // Seed all days for each equipment so UI always has full range
  for (const id of equipmentIds) {
    for (const key of dayKeys) ensureDay(id, key)
  }

  for (const order of orders) {
    for (const item of order.equipmentItems) {
      if (!item.equipmentId) continue
      const itemFrom = item.dateFrom ?? order.dateFrom
      const itemTo = item.dateTo ?? order.dateTo
      if (!overlaps(itemFrom, itemTo, dateFrom, dateTo)) continue
      const overlapFrom = itemFrom < dateFrom ? dateFrom : itemFrom
      const overlapTo = itemTo > dateTo ? dateTo : itemTo
      const qty = Math.max(1, Math.floor(item.quantity ?? 1))
      for (const day of eachDayUtc(overlapFrom, overlapTo)) {
        const key = toDayKeyUtc(day)
        const d = ensureDay(item.equipmentId, key)
        d.reservedFromOrders += qty
        d.sources.push({
          kind: 'ORDER',
          orderId: order.id,
          orderName: order.name,
          dateFrom: order.dateFrom,
          dateTo: order.dateTo,
          quantity: qty,
        })
      }
    }
  }

  for (const block of blocks) {
    if (!overlaps(block.dateFrom, block.dateTo, dateFrom, dateTo)) continue
    const overlapFrom = block.dateFrom < dateFrom ? dateFrom : block.dateFrom
    const overlapTo = block.dateTo > dateTo ? dateTo : block.dateTo
    const qty = Math.max(1, Math.floor(block.quantity ?? 1))
    for (const day of eachDayUtc(overlapFrom, overlapTo)) {
      const key = toDayKeyUtc(day)
      const d = ensureDay(block.equipmentId, key)
      d.reservedFromBlocks += qty
      d.sources.push({
        kind: 'BLOCK',
        blockId: block.id,
        note: block.note ?? null,
        dateFrom: block.dateFrom,
        dateTo: block.dateTo,
        quantity: qty,
      })
    }
  }

  // Finalize per-day totals and compute isAvailable
  const out: EquipmentAvailabilityDetailed[] = []
  for (const equipmentId of equipmentIds) {
    const eq = eqById.get(equipmentId)
    const stockQuantity = eq?.stockQuantity ?? 0
    const requestedQuantity = requestQtyByEquipmentId.get(equipmentId) ?? 1
    const dayMap = perEqDay.get(equipmentId) ?? new Map<string, AvailabilityDay>()
    const days = dayKeys.map((k) => dayMap.get(k)!).map((d) => {
      const reservedTotal = d.reservedFromOrders + d.reservedFromBlocks
      const available = Math.max(0, stockQuantity - reservedTotal)
      return { ...d, reservedTotal, available }
    })

    const maxReserved = days.reduce((m, d) => Math.max(m, d.reservedTotal), 0)
    const minAvailable = days.reduce((m, d) => Math.min(m, d.available), stockQuantity)
    const isAvailable = days.every((d) => stockQuantity - d.reservedTotal >= requestedQuantity)

    const conflictingOrdersMap = new Map<string, { orderId: string; orderName: string; dateFrom: Date; dateTo: Date }>()
    const conflictingBlocksMap = new Map<string, { blockId: string; note: string | null; dateFrom: Date; dateTo: Date }>()
    for (const d of days) {
      if (stockQuantity - d.reservedTotal >= requestedQuantity) continue
      for (const s of d.sources) {
        if (s.kind === 'ORDER') {
          conflictingOrdersMap.set(s.orderId, {
            orderId: s.orderId,
            orderName: s.orderName,
            dateFrom: s.dateFrom,
            dateTo: s.dateTo,
          })
        } else {
          conflictingBlocksMap.set(s.blockId, {
            blockId: s.blockId,
            note: s.note,
            dateFrom: s.dateFrom,
            dateTo: s.dateTo,
          })
        }
      }
    }

    out.push({
      equipmentId,
      equipmentName: eq?.name ?? 'Sprzęt',
      stockQuantity,
      requestedQuantity,
      isAvailable,
      summary: { maxReserved, minAvailable },
      days,
      conflictingOrders: Array.from(conflictingOrdersMap.values()),
      conflictingBlocks: Array.from(conflictingBlocksMap.values()),
    })
  }

  return out
}

