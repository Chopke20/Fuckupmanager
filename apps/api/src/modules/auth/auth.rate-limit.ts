import { NextFunction, Request, Response } from 'express'
import { AppError } from '../../shared/errors/AppError'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function getClientKey(req: Request): string {
  const ip = typeof req.headers['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
    : req.socket.remoteAddress || 'unknown'
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : ''
  return `${ip}:${email}`
}

export function createRateLimit(maxHits: number, windowMs: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = getClientKey(req)
    const now = Date.now()
    const current = buckets.get(key)
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }
    if (current.count >= maxHits) {
      return next(new AppError('Za dużo prób. Spróbuj ponownie później.', 429, 'RATE_LIMITED'))
    }
    current.count += 1
    buckets.set(key, current)
    return next()
  }
}
