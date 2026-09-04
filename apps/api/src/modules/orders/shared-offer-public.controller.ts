import { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { SharedOfferPartnerLineSchema, MAX_SHARED_OFFER_LINES } from '@lama-stage/shared-types'
import { AppError } from '../../shared/errors/AppError'
import { runWithCompanyContext } from '../../shared/context/company-context'
import { assertRateLimit, clientIp } from '../../shared/middleware/public-rate-limit'
import { PdfController } from '../pdf/pdf.controller'
import { isValidPublicToken } from './public-token-lookup'
import {
  buildPublicView,
  findSessionByToken,
  loadOrderForSharedOffer,
  logEvent,
  parsePartnerPayload,
  savePartnerLines,
} from './shared-offer.service'

const pdfController = new PdfController()

function tokenFromReq(req: Request): string {
  const token = typeof req.params.token === 'string' ? req.params.token : ''
  if (!isValidPublicToken(token)) {
    throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')
  }
  return token
}

const SaveBodySchema = z.object({
  lines: z.array(SharedOfferPartnerLineSchema).max(MAX_SHARED_OFFER_LINES),
  lockedFingerprint: z.string().min(1).max(128).optional(),
})

const PdfBodySchema = z.object({
  lockedFingerprint: z.string().min(1).max(128).optional(),
})

export const getSharedOffer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertRateLimit(`so:${clientIp(req)}`, 60, 60_000)
    const token = tokenFromReq(req)
    const found = await findSessionByToken(token)
    if (!found) throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')

    await runWithCompanyContext(found.companyCode, async () => {
      if (found.session.revokedAt) {
        throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')
      }
      const order = await loadOrderForSharedOffer(found.session.orderId)
      if (!order || order.isDeleted) {
        throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')
      }
      await logEvent(found.session.id, 'OPEN')
      const view = await buildPublicView(order, found.session)
      res.setHeader('X-Company-Code', found.companyCode)
      res.json({ data: view })
    })
  } catch (error) {
    next(error)
  }
}

export const putSharedOfferLines = async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertRateLimit(`so:${clientIp(req)}`, 30, 60_000)
    const token = tokenFromReq(req)
    const found = await findSessionByToken(token)
    if (!found) throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')

    await runWithCompanyContext(found.companyCode, async () => {
      if (found.session.revokedAt) {
        throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')
      }
      const order = await loadOrderForSharedOffer(found.session.orderId)
      if (!order || order.isDeleted) {
        throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')
      }

      const body = SaveBodySchema.parse(req.body ?? {})
      const currentView = await buildPublicView(order, found.session)

      if (body.lockedFingerprint && body.lockedFingerprint !== currentView.lockedFingerprint) {
        throw new AppError(
          'Pozycje Lama Stage zmieniły się od otwarcia edytora.',
          409,
          'LOCKED_CHANGED',
          { view: { ...currentView, partnerLines: body.lines } }
        )
      }

      const updatedSession = await savePartnerLines(found.session.id, { lines: body.lines })
      const view = await buildPublicView(order, updatedSession)
      res.setHeader('X-Company-Code', found.companyCode)
      res.json({ data: view })
    })
  } catch (error) {
    next(error)
  }
}

export const postSharedOfferPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = tokenFromReq(req)
    assertRateLimit(`so-pdf:${token}`, 5, 60_000)
    assertRateLimit(`so-pdf-h:${token}`, 30, 3_600_000)

    const found = await findSessionByToken(token)
    if (!found) throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')

    await runWithCompanyContext(found.companyCode, async () => {
      if (found.session.revokedAt) {
        throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')
      }
      const order = await loadOrderForSharedOffer(found.session.orderId)
      if (!order || order.isDeleted) {
        throw new AppError('Nie znaleziono oferty.', 404, 'NOT_FOUND')
      }

      const body = PdfBodySchema.parse(req.body ?? {})
      const currentView = await buildPublicView(order, found.session)

      if (body.lockedFingerprint && body.lockedFingerprint !== currentView.lockedFingerprint) {
        throw new AppError(
          'Pozycje Lama Stage zmieniły się od otwarcia edytora.',
          409,
          'LOCKED_CHANGED',
          { view: currentView }
        )
      }

      const payload = parsePartnerPayload(found.session.partnerPayloadJson)
      await pdfController.generateSharedOfferPdf(found.session.orderId, payload.lines, res)
      await logEvent(found.session.id, 'PDF')
    })
  } catch (error) {
    next(error)
  }
}
