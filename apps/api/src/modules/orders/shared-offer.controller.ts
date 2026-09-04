import { NextFunction, Request, Response } from 'express'
import { writeAuditLog } from '../auth/audit.service'
import { prisma } from '../../prisma/client'
import { AppError } from '../../shared/errors/AppError'
import {
  getOrCreateSession,
  getSessionStatus,
  revokeSession,
} from './shared-offer.service'

function getClientIp(req: Request): string | undefined {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string') return xff.split(',')[0]?.trim()
  return req.socket.remoteAddress
}

async function assertToinenModeEnabled() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } }).catch(() => null)
  if (!settings?.enableToinenMusicMode) {
    throw new AppError('Tryb Toinen Music jest wyłączony w ustawieniach aplikacji.', 400)
  }
}

export const getSharedOfferStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = req.params.id
    if (!orderId) throw new AppError('Missing order ID', 400)
    const status = await getSessionStatus(orderId)
    res.json({ data: status })
  } catch (error) {
    next(error)
  }
}

export const createSharedOfferLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = req.params.id
    if (!orderId) throw new AppError('Missing order ID', 400)
    await assertToinenModeEnabled()

    const user = res.locals.user as { id?: string; email?: string } | undefined
    const session = await getOrCreateSession(orderId, user?.id ?? null)

    if (user?.id && user?.email) {
      await writeAuditLog({
        actorUserId: user.id,
        actorEmail: user.email,
        module: 'orders',
        action: 'shared_offer.link_create',
        targetType: 'Order',
        targetId: orderId,
        result: 'SUCCESS',
        requestId: res.locals.requestId || req.header('x-request-id') || null,
        ipAddress: getClientIp(req) || null,
        userAgent: req.headers['user-agent'] || null,
      })
    }

    res.json({
      data: {
        token: session.publicToken,
        url: null as string | null,
        revokedAt: session.revokedAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    next(error)
  }
}

export const revokeSharedOfferLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = req.params.id
    if (!orderId) throw new AppError('Missing order ID', 400)
    await assertToinenModeEnabled()

    const session = await revokeSession(orderId)
    const user = res.locals.user as { id?: string; email?: string } | undefined
    if (user?.id && user?.email) {
      await writeAuditLog({
        actorUserId: user.id,
        actorEmail: user.email,
        module: 'orders',
        action: 'shared_offer.link_revoke',
        targetType: 'Order',
        targetId: orderId,
        result: 'SUCCESS',
        requestId: res.locals.requestId || req.header('x-request-id') || null,
        ipAddress: getClientIp(req) || null,
        userAgent: req.headers['user-agent'] || null,
      })
    }

    res.json({
      data: {
        token: session.publicToken,
        revokedAt: session.revokedAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    next(error)
  }
}
