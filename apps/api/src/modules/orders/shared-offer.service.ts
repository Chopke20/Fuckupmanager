import { createHash } from 'node:crypto'
import type { OrderSharedOfferSession } from '@prisma/client'
import {
  SharedOfferPartnerPayloadSchema,
  SharedOfferPublicViewSchema,
  applyGlobalDiscountAndVat,
  computeProposalEquipmentNet,
  computeProposalProductionNet,
  type SharedOfferLockedLine,
  type SharedOfferPartnerLine,
  type SharedOfferPartnerPayload,
  type SharedOfferPublicView,
  type SharedOfferTotals,
} from '@lama-stage/shared-types'
import { prisma } from '../../prisma/client'
import { AppError } from '../../shared/errors/AppError'
import { findAcrossCompanies, isValidPublicToken, newPublicToken } from './public-token-lookup'
import { parseJsonSafely } from './order-document-draft-utils'

type OrderForSharedOffer = NonNullable<Awaited<ReturnType<typeof loadOrderForSharedOffer>>>

export async function loadOrderForSharedOffer(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: true,
      offerBlocks: { orderBy: { sortOrder: 'asc' } },
      equipmentItems: {
        include: { equipment: true },
        orderBy: { sortOrder: 'asc' },
      },
      productionItems: {
        where: { visibleInOffer: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
}

function emptyPartnerPayload(): SharedOfferPartnerPayload {
  return { lines: [] }
}

export function parsePartnerPayload(raw: string | null | undefined): SharedOfferPartnerPayload {
  const parsed = parseJsonSafely(raw ?? null)
  const result = SharedOfferPartnerPayloadSchema.safeParse(parsed ?? { lines: [] })
  return result.success ? result.data : emptyPartnerPayload()
}

function partnerLineNet(line: SharedOfferPartnerLine): number {
  if (line.kind === 'EQUIPMENT') {
    return computeProposalEquipmentNet({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      days: line.days,
      discount: line.discount,
    })
  }
  return computeProposalProductionNet({
    rateValue: line.unitPrice,
    units: line.quantity,
    discount: line.discount,
  })
}

export function buildLockedLines(order: OrderForSharedOffer): SharedOfferLockedLine[] {
  const equipment: SharedOfferLockedLine[] = order.equipmentItems
    .filter((item) => item.visibleInOffer !== false)
    .map((item) => ({
      kind: 'EQUIPMENT' as const,
      name: item.name,
      description: item.description ?? null,
      category: item.category ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      days: item.days ?? 1,
      discount: item.discount ?? 0,
      offerBlockId: item.offerBlockId ?? null,
      unit: item.equipment?.unit ?? null,
    }))

  const production: SharedOfferLockedLine[] = order.productionItems
    .filter((item) => item.visibleInOffer !== false && !item.isTransport)
    .map((item) => ({
      kind: 'PRODUCTION' as const,
      name: item.name,
      description: item.description ?? null,
      category: null,
      quantity: item.units,
      unitPrice: item.rateValue,
      days: 1,
      discount: item.discount ?? 0,
      offerBlockId: item.offerBlockId ?? null,
      unit: null,
    }))

  return [...equipment, ...production]
}

export function computeLockedFingerprint(lockedLines: SharedOfferLockedLine[]): string {
  const stable = JSON.stringify(lockedLines)
  return createHash('sha256').update(stable).digest('hex')
}

function computeOwnNet(order: OrderForSharedOffer): number {
  const eqNet = order.equipmentItems
    .filter((item) => item.visibleInOffer !== false)
    .reduce((sum, item) => sum + computeProposalEquipmentNet(item), 0)
  const prodNet = order.productionItems
    .filter((item) => item.visibleInOffer !== false)
    .reduce((sum, item) => sum + computeProposalProductionNet(item), 0)
  return Math.round((eqNet + prodNet) * 100) / 100
}

function computeTotals(order: OrderForSharedOffer, partnerLines: SharedOfferPartnerLine[]): SharedOfferTotals {
  const ownNet = computeOwnNet(order)
  const partnerNet = Math.round(partnerLines.reduce((sum, line) => sum + partnerLineNet(line), 0) * 100) / 100
  const totalNetBeforeGlobal = Math.round((ownNet + partnerNet) * 100) / 100
  const discountGlobal = order.discountGlobal ?? 0
  const vatRate = order.vatRate === 0 ? 0 : 23
  const { netAfterDiscount, vatAmount, grossTotal } = applyGlobalDiscountAndVat({
    netBeforeGlobal: totalNetBeforeGlobal,
    discountGlobal,
    vatRate,
  })
  return {
    ownNet,
    partnerNet,
    totalNet: netAfterDiscount,
    vatRate,
    vatAmount,
    grossTotal,
    discountGlobal,
    currency: order.currency ?? 'PLN',
  }
}

function sanitizePartnerLines(
  lines: SharedOfferPartnerLine[],
  blockIds: Set<string>
): { lines: SharedOfferPartnerLine[]; changed: boolean } {
  let changed = false
  const next = lines.map((line) => {
    if (line.offerBlockId && !blockIds.has(line.offerBlockId)) {
      changed = true
      return { ...line, offerBlockId: null }
    }
    return line
  })
  return { lines: next, changed }
}

export async function buildPublicView(
  order: OrderForSharedOffer,
  session: OrderSharedOfferSession
): Promise<SharedOfferPublicView> {
  const lockedLines = buildLockedLines(order)
  const blockIds = new Set(order.offerBlocks.map((b) => b.id))
  const payload = parsePartnerPayload(session.partnerPayloadJson)
  const { lines: partnerLines, changed } = sanitizePartnerLines(payload.lines, blockIds)

  if (changed) {
    await prisma.orderSharedOfferSession.update({
      where: { id: session.id },
      data: { partnerPayloadJson: JSON.stringify({ lines: partnerLines }) },
    })
  }

  const view: SharedOfferPublicView = {
    status: session.revokedAt ? 'REVOKED' : 'ACTIVE',
    orderName: order.name,
    venue: order.venue ?? null,
    startDate: order.startDate.toISOString(),
    endDate: order.endDate.toISOString(),
    clientCompanyName: order.client?.companyName ?? null,
    blocks: order.offerBlocks.map((b) => ({
      id: b.id,
      title: b.title,
      sortOrder: b.sortOrder ?? 0,
    })),
    lockedLines,
    partnerLines,
    totals: computeTotals(order, partnerLines),
    lastSavedAt: session.lastSavedAt?.toISOString() ?? null,
    lockedFingerprint: computeLockedFingerprint(lockedLines),
  }

  return SharedOfferPublicViewSchema.parse(view)
}

async function createSessionWithToken(
  orderId: string,
  userId: string | null,
  existingId?: string
): Promise<OrderSharedOfferSession> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const publicToken = newPublicToken()
    try {
      if (existingId) {
        return await prisma.orderSharedOfferSession.update({
          where: { id: existingId },
          data: {
            publicToken,
            revokedAt: null,
            createdById: userId,
          },
        })
      }
      return await prisma.orderSharedOfferSession.create({
        data: {
          orderId,
          publicToken,
          partnerPayloadJson: JSON.stringify(emptyPartnerPayload()),
          createdById: userId,
        },
      })
    } catch (error) {
      const isUnique =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      if (!isUnique || attempt === 4) throw error
    }
  }
  throw new AppError('Nie udało się utworzyć unikalnego tokenu sesji.', 500)
}

export async function getOrCreateSession(orderId: string, userId: string | null) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.isDeleted) {
    throw new AppError('Zlecenie nie zostało znalezione', 404, 'NOT_FOUND')
  }

  const existing = await prisma.orderSharedOfferSession.findUnique({ where: { orderId } })
  if (existing && !existing.revokedAt) {
    return existing
  }
  if (existing && existing.revokedAt) {
    return createSessionWithToken(orderId, userId, existing.id)
  }
  return createSessionWithToken(orderId, userId)
}

export async function revokeSession(orderId: string) {
  const existing = await prisma.orderSharedOfferSession.findUnique({ where: { orderId } })
  if (!existing) {
    throw new AppError('Brak aktywnego linku oferty współdzielonej.', 404, 'NOT_FOUND')
  }
  if (existing.revokedAt) return existing
  return prisma.orderSharedOfferSession.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  })
}

export async function getSessionStatus(orderId: string) {
  const session = await prisma.orderSharedOfferSession.findUnique({
    where: { orderId },
    include: {
      events: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  })
  if (!session) {
    return {
      hasSession: false as const,
      session: null,
      partnerLineCount: 0,
      partnerNet: 0,
      events: [] as Array<{ id: string; eventType: string; createdAt: string }>,
    }
  }

  const payload = parsePartnerPayload(session.partnerPayloadJson)
  const partnerNet = Math.round(payload.lines.reduce((sum, line) => sum + partnerLineNet(line), 0) * 100) / 100

  return {
    hasSession: true as const,
    session: {
      id: session.id,
      publicToken: session.publicToken,
      revokedAt: session.revokedAt?.toISOString() ?? null,
      lastSavedAt: session.lastSavedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
    partnerLineCount: payload.lines.length,
    partnerNet,
    events: session.events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      createdAt: e.createdAt.toISOString(),
    })),
  }
}

export async function findSessionByToken(token: string) {
  if (!isValidPublicToken(token)) return null
  const found = await findAcrossCompanies(() =>
    prisma.orderSharedOfferSession.findFirst({
      where: { publicToken: token },
    })
  )
  if (!found) return null
  return { companyCode: found.companyCode, session: found.value }
}

export async function logEvent(sessionId: string, eventType: 'OPEN' | 'SAVE' | 'PDF') {
  await prisma.sharedOfferSessionEvent.create({
    data: { sessionId, eventType },
  })
}

export async function savePartnerLines(sessionId: string, payload: SharedOfferPartnerPayload) {
  const validated = SharedOfferPartnerPayloadSchema.parse(payload)
  const updated = await prisma.orderSharedOfferSession.update({
    where: { id: sessionId },
    data: {
      partnerPayloadJson: JSON.stringify(validated),
      lastSavedAt: new Date(),
    },
  })
  await logEvent(sessionId, 'SAVE')
  return updated
}

export type { OrderForSharedOffer }
