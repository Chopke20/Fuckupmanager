import { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import {
  ProposalClientSignalsSchema,
  ProposalPublicEventTypeSchema,
} from '@lama-stage/shared-types'
import { prisma } from '../../prisma/client'
import { AppError } from '../../shared/errors/AppError'
import { runWithCompanyContext } from '../../shared/context/company-context'
import { PdfController } from '../pdf/pdf.controller'
import {
  findProposalExportByPublicToken,
  isValidProposalPublicToken,
  parseClientSignals,
  snapshotFromExport,
} from './proposal-publish'

const rateHits = new Map<string, { n: number; resetAt: number }>()

function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0]!.trim()
  return req.ip || 'unknown'
}

function assertRateLimit(req: Request) {
  const now = Date.now()
  const key = clientIp(req)
  const cur = rateHits.get(key)
  if (!cur || cur.resetAt < now) {
    rateHits.set(key, { n: 1, resetAt: now + 60_000 })
    return
  }
  if (cur.n >= 60) {
    throw new AppError('Zbyt wiele żądań. Spróbuj za chwilę.', 429, 'RATE_LIMIT')
  }
  cur.n += 1
}

function tokenFromReq(req: Request): string {
  const token = typeof req.params.token === 'string' ? req.params.token : ''
  if (!isValidProposalPublicToken(token)) {
    throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')
  }
  return token
}

export const getPublicProposal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertRateLimit(req)
    const token = tokenFromReq(req)
    const found = await findProposalExportByPublicToken(token)
    if (!found) throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')

    await runWithCompanyContext(found.companyCode, async () => {
      const snapshot = snapshotFromExport(found.export.snapshot)
      if (!snapshot) throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')
      const expired = found.export.expiresAt ? found.export.expiresAt.getTime() < Date.now() : false
      if (!expired) {
        await prisma.proposalPublicEvent.create({
          data: { exportId: found.export.id, eventType: 'OPEN' },
        })
      }
      const signals = parseClientSignals(found.export.clientSignalsJson)
      res.setHeader('X-Company-Code', found.companyCode)
      res.json({
        data: {
          status: expired ? 'EXPIRED' : 'ACTIVE',
          documentNumber: found.export.documentNumber,
          expiresAt: found.export.expiresAt?.toISOString() ?? snapshot.expiresAt,
          signals,
          snapshot: expired
            ? {
                ...snapshot,
                scope: [],
                options: [],
                finance: {
                  ...snapshot.finance,
                  equipmentNet: 0,
                  productionNet: 0,
                  transportNet: 0,
                  netAfterDiscount: 0,
                  vatAmount: 0,
                  grossTotal: 0,
                },
              }
            : snapshot,
        },
      })
    })
  } catch (error) {
    next(error)
  }
}

export const postPublicProposalEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertRateLimit(req)
    const token = tokenFromReq(req)
    const parsed = ProposalPublicEventTypeSchema.safeParse(req.body?.eventType)
    if (!parsed.success) throw new AppError('Nieprawidłowy typ zdarzenia.', 400)
    if (parsed.data === 'OPEN') {
      res.json({ data: { ok: true as const } })
      return
    }
    const found = await findProposalExportByPublicToken(token)
    if (!found) throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')
    await runWithCompanyContext(found.companyCode, async () => {
      const expired = found.export.expiresAt ? found.export.expiresAt.getTime() < Date.now() : false
      if (expired) throw new AppError('Oferta wygasła.', 410, 'EXPIRED')
      await prisma.proposalPublicEvent.create({
        data: { exportId: found.export.id, eventType: parsed.data },
      })
      res.json({ data: { ok: true as const } })
    })
  } catch (error) {
    next(error)
  }
}

export const postPublicProposalSignals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertRateLimit(req)
    const token = tokenFromReq(req)
    const found = await findProposalExportByPublicToken(token)
    if (!found) throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')
    await runWithCompanyContext(found.companyCode, async () => {
      const expired = found.export.expiresAt ? found.export.expiresAt.getTime() < Date.now() : false
      if (expired) throw new AppError('Oferta wygasła.', 410, 'EXPIRED')
      const snapshot = snapshotFromExport(found.export.snapshot)
      const allowedIds = new Set((snapshot?.options ?? []).map((o) => o.id))
      const current = parseClientSignals(found.export.clientSignalsJson)
      const incoming = z
        .object({
          interestedOptionIds: z.array(z.string().min(1).max(80)).max(6).optional(),
          discussRequested: z.boolean().optional(),
        })
        .parse(req.body ?? {})
      const interested = (incoming.interestedOptionIds ?? current.interestedOptionIds).filter((id) =>
        allowedIds.has(id)
      )
      const discussRequestedAt =
        incoming.discussRequested === true
          ? current.discussRequestedAt ?? new Date().toISOString()
          : current.discussRequestedAt
      const next = ProposalClientSignalsSchema.parse({
        interestedOptionIds: interested,
        discussRequestedAt,
      })
      await prisma.orderDocumentExport.update({
        where: { id: found.export.id },
        data: { clientSignalsJson: JSON.stringify(next) },
      })
      if (incoming.discussRequested === true && !current.discussRequestedAt) {
        await prisma.proposalPublicEvent.create({
          data: { exportId: found.export.id, eventType: 'CTA' },
        })
      }
      res.json({ data: next })
    })
  } catch (error) {
    next(error)
  }
}

const pdfController = new PdfController()

export const getPublicProposalPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertRateLimit(req)
    const token = tokenFromReq(req)
    const found = await findProposalExportByPublicToken(token)
    if (!found) throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')
    await runWithCompanyContext(found.companyCode, async () => {
      const expired = found.export.expiresAt ? found.export.expiresAt.getTime() < Date.now() : false
      if (expired) throw new AppError('Oferta wygasła — PDF nie jest już dostępny pod tym linkiem.', 410, 'EXPIRED')
      const snapshot = snapshotFromExport(found.export.snapshot)
      if (!snapshot?.offer.exportId) throw new AppError('Brak powiązanej Oferty PDF.', 400)
      await prisma.proposalPublicEvent.create({
        data: { exportId: found.export.id, eventType: 'PDF' },
      })
      await pdfController.sendOfferExportPdf(snapshot.offer.exportId, res, false)
    })
  } catch (error) {
    next(error)
  }
}
