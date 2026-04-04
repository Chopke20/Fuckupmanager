import { Request, Response, NextFunction } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../prisma/client'
import { AppError } from '../../shared/errors/AppError'
import {
  DocumentTypeSchema,
  OfferDocumentDraftSchema,
  WarehouseDocumentDraftSchema,
  WarehouseSnapshotSchema,
} from '@lama-stage/shared-types'
import {
  buildDefaultDraft,
  buildOfferDefaultDraft,
  buildDocumentNumber,
  parseJsonSafely,
} from './order-document-draft-utils'
import { buildOrderOfferSnapshotFromOrder, loadOfferDraftPayload } from './offer-snapshot-merge'

/** Po usunięciu eksportu OFFER: `offerVersion` / `offerNumber` = najwyższa wersja z pozostałych snapshotów, albo reset (0 / null). */
async function syncOrderOfferFromRemainingExports(tx: Prisma.TransactionClient, orderId: string) {
  const remaining = await tx.orderDocumentExport.findMany({
    where: { orderId, documentType: 'OFFER' },
    orderBy: { exportedAt: 'desc' },
  })

  if (remaining.length === 0) {
    await tx.order.update({
      where: { id: orderId },
      data: { offerVersion: 0, offerNumber: null },
    })
    return
  }

  let maxVersion = 0
  let documentNumberForMax: string | null = null
  for (const e of remaining) {
    const parts = e.documentNumber.split('.')
    if (parts.length >= 3) {
      const v = parseInt(parts[1]!, 10)
      if (!Number.isNaN(v) && v >= maxVersion) {
        maxVersion = v
        documentNumberForMax = e.documentNumber
      }
    }
  }

  if (maxVersion > 0 && documentNumberForMax) {
    await tx.order.update({
      where: { id: orderId },
      data: { offerVersion: maxVersion, offerNumber: documentNumberForMax },
    })
  } else {
    const latest = remaining[0]!
    await tx.order.update({
      where: { id: orderId },
      data: {
        offerVersion: remaining.length,
        offerNumber: latest.documentNumber,
      },
    })
  }
}

export const listOrderDocumentExports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: orderId } = req.params
    if (!orderId) throw new AppError('Missing order ID', 400)

    const documentType = typeof req.query.documentType === 'string' ? req.query.documentType : undefined
    const where: Prisma.OrderDocumentExportWhereInput = { orderId }
    if (documentType) {
      where.documentType = documentType
    }

    const exports = await prisma.orderDocumentExport.findMany({
      where,
      orderBy: { exportedAt: 'desc' },
      select: {
        id: true,
        orderId: true,
        documentType: true,
        documentNumber: true,
        exportedAt: true,
        createdAt: true,
      },
    })

    res.json({ data: exports })
  } catch (error) {
    next(error)
  }
}

export const getOrderDocumentExport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: orderId, exportId } = req.params
    if (!orderId || !exportId) throw new AppError('Missing ID', 400)

    const doc = await prisma.orderDocumentExport.findFirst({
      where: { id: exportId, orderId },
    })

    if (!doc) {
      return res.status(404).json({ error: { message: 'Eksport dokumentu nie został znaleziony', code: 'NOT_FOUND' } })
    }

    let snapshot: unknown
    try {
      snapshot = JSON.parse(doc.snapshot)
    } catch {
      snapshot = null
    }

    res.json({
      data: {
        id: doc.id,
        orderId: doc.orderId,
        documentType: doc.documentType,
        documentNumber: doc.documentNumber,
        exportedAt: doc.exportedAt,
        createdAt: doc.createdAt,
        snapshot,
      },
    })
  } catch (error) {
    next(error)
  }
}

export const deleteOrderDocumentExport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: orderId, exportId } = req.params
    if (!orderId || !exportId) throw new AppError('Missing ID', 400)

    await prisma.$transaction(async (tx) => {
      const doc = await tx.orderDocumentExport.findFirst({
        where: { id: exportId, orderId },
      })
      if (!doc) {
        throw new AppError('Eksport dokumentu nie został znaleziony', 404)
      }
      const wasOffer = doc.documentType === 'OFFER'
      await tx.orderDocumentExport.delete({ where: { id: exportId } })
      if (wasOffer) {
        await syncOrderOfferFromRemainingExports(tx, orderId)
      }
    })

    res.json({ data: { ok: true as const } })
  } catch (error) {
    next(error)
  }
}

export const getOrderDocumentDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: orderId } = req.params
    if (!orderId) throw new AppError('Missing order ID', 400)

    const parsedType = DocumentTypeSchema.safeParse(req.query.documentType)
    if (!parsedType.success) {
      throw new AppError('Nieprawidłowy typ dokumentu', 400)
    }
    const documentType = parsedType.data

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) {
      return res.status(404).json({ error: { message: 'Zlecenie nie zostało znalezione', code: 'NOT_FOUND' } })
    }

    const draft = await prisma.orderDocumentDraft.findUnique({
      where: {
        orderId_documentType: {
          orderId,
          documentType,
        },
      },
    })

    const parsed = parseJsonSafely(draft?.payload ?? null)
    let payload: unknown
    if (documentType === 'OFFER') {
      payload =
        parsed != null ? OfferDocumentDraftSchema.parse(parsed) : await buildOfferDefaultDraft(prisma, order)
    } else if (documentType === 'WAREHOUSE') {
      if (parsed != null) {
        const w = WarehouseDocumentDraftSchema.safeParse(parsed)
        payload = w.success ? w.data : buildDefaultDraft(order, documentType)
      } else {
        payload = buildDefaultDraft(order, documentType)
      }
    } else {
      payload = parsed != null ? parsed : buildDefaultDraft(order, documentType)
    }
    res.json({
      data: {
        id: draft?.id ?? null,
        orderId,
        documentType,
        payload,
        createdAt: draft?.createdAt?.toISOString() ?? null,
        updatedAt: draft?.updatedAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    next(error)
  }
}

export const updateOrderDocumentDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: orderId } = req.params
    if (!orderId) throw new AppError('Missing order ID', 400)

    const parsedType = DocumentTypeSchema.safeParse(req.body?.documentType)
    if (!parsedType.success) {
      throw new AppError('Nieprawidłowy typ dokumentu', 400)
    }
    const documentType = parsedType.data
    const rawPayload = req.body?.payload
    if (!rawPayload || typeof rawPayload !== 'object') {
      throw new AppError('Brak payload draftu dokumentu', 400)
    }

    let payload: unknown = rawPayload
    if (documentType === 'OFFER') {
      payload = OfferDocumentDraftSchema.parse(rawPayload)
    } else if (documentType === 'WAREHOUSE') {
      payload = WarehouseDocumentDraftSchema.parse(rawPayload)
    }

    const created = await prisma.orderDocumentDraft.upsert({
      where: {
        orderId_documentType: {
          orderId,
          documentType,
        },
      },
      create: {
        orderId,
        documentType,
        payload: JSON.stringify(payload),
      },
      update: {
        payload: JSON.stringify(payload),
      },
    })

    res.json({
      data: {
        id: created.id,
        orderId: created.orderId,
        documentType: created.documentType,
        payload,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    next(error)
  }
}

export const createOrderDocumentExport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: orderId } = req.params
    if (!orderId) throw new AppError('Missing order ID', 400)

    const parsedType = DocumentTypeSchema.safeParse(req.body?.documentType)
    if (!parsedType.success) {
      throw new AppError('Nieprawidłowy typ dokumentu', 400)
    }

    const documentType = parsedType.data

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: true,
        stages: { orderBy: { sortOrder: 'asc' } },
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

    if (!order) {
      return res.status(404).json({ error: { message: 'Zlecenie nie zostało znalezione', code: 'NOT_FOUND' } })
    }

    if (documentType === 'OFFER' && !order.client) {
      throw new AppError('Zlecenie nie ma przypisanego klienta — brak danych do oferty', 400)
    }

    const orderYear = order.orderYear ?? new Date(order.createdAt).getFullYear()
    const orderNumber = order.orderNumber

    if (orderNumber == null || orderYear == null) {
      throw new AppError(
        'Zlecenie nie ma nadanego numeru. Uruchom skrypt backfillu numeracji lub utwórz zlecenie ponownie.',
        400
      )
    }

    const draftRecord = await prisma.orderDocumentDraft.findUnique({
      where: {
        orderId_documentType: {
          orderId,
          documentType,
        },
      },
    })
    const parsedDraft = parseJsonSafely(draftRecord?.payload ?? null)
    const draftPayload =
      documentType === 'OFFER'
        ? parsedDraft != null
          ? OfferDocumentDraftSchema.parse(parsedDraft)
          : await buildOfferDefaultDraft(prisma, order)
        : parsedDraft != null
          ? parsedDraft
          : buildDefaultDraft(order, documentType)

    const normalizedClient = {
      ...order.client,
      createdAt: order.client.createdAt.toISOString(),
      updatedAt: order.client.updatedAt.toISOString(),
      deletedAt: order.client.deletedAt ? order.client.deletedAt.toISOString() : null,
    }
    const normalizedStages = order.stages.map((s) => ({
      ...s,
      date: s.date.toISOString(),
      createdAt: s.createdAt.toISOString(),
    }))
    const normalizedEquipmentItems = order.equipmentItems.map((e) => ({
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
    const normalizedProductionItems = order.productionItems.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))

    let snapshot: unknown
    if (documentType === 'OFFER') {
      // Snapshot z OFFER budowany w transakcji (numer + generatedAt) — patrz $transaction poniżej
      snapshot = null
    } else if (documentType === 'WAREHOUSE') {
      const parsedDraft = WarehouseDocumentDraftSchema.parse(draftPayload)
      snapshot = WarehouseSnapshotSchema.parse({
        orderId: order.id,
        orderYear,
        orderNumber,
        documentType: 'WAREHOUSE',
        title: parsedDraft.title,
        notes: parsedDraft.notes ?? undefined,
        generatedAt: new Date().toISOString(),
        client: normalizedClient,
        venue: order.venue ?? undefined,
        venuePlaceId: order.venuePlaceId ?? undefined,
        startDate: order.startDate.toISOString(),
        endDate: order.endDate.toISOString(),
        equipmentItems: normalizedEquipmentItems,
        itemLoadChecked: parsedDraft.checked,
      })
    } else {
      snapshot = {
        orderId: order.id,
        orderYear,
        orderNumber,
        documentType,
        generatedAt: new Date().toISOString(),
        client: normalizedClient,
        stages: normalizedStages,
        equipmentItems: normalizedEquipmentItems,
        productionItems: normalizedProductionItems,
        documentDraft: draftPayload,
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.orderDocumentExport.count({
        where: { orderId, documentType },
      })
      const version = existingCount + 1
      const documentNumber = buildDocumentNumber({
        documentType,
        orderNumber,
        orderYear,
        version,
      })

      let snapshotJson: string
      if (documentType === 'OFFER') {
        const generatedAt = new Date().toISOString()
        const offerDraft = await loadOfferDraftPayload(tx, orderId, order)
        const offerSnapshot = buildOrderOfferSnapshotFromOrder(order, offerDraft, {
          generatedAt,
          documentNumber,
        })
        snapshotJson = JSON.stringify(offerSnapshot)
      } else {
        snapshotJson = JSON.stringify(snapshot)
      }

      const created = await tx.orderDocumentExport.create({
        data: {
          orderId,
          documentType,
          documentNumber,
          snapshot: snapshotJson,
        },
      })

      if (documentType === 'OFFER') {
        // Keep offerVersion/offerNumber on Order in sync for backwards compatibility
        await tx.order.update({
          where: { id: orderId },
          data: {
            offerVersion: version,
            offerNumber: documentNumber,
          },
        })
      }

      return created
    })

    res.status(201).json({
      data: {
        id: result.id,
        orderId: result.orderId,
        documentType: result.documentType,
        documentNumber: result.documentNumber,
        exportedAt: result.exportedAt,
        createdAt: result.createdAt,
      },
    })
  } catch (error) {
    next(error)
  }
}

