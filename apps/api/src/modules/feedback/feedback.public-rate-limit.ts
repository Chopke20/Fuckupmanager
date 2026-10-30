import { NextFunction, Request, Response } from 'express'
import { AppError } from '../../shared/errors/AppError'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0]?.trim() || req.ip || 'unknown'
  }
  if (Array.isArray(xf) && xf[0]) return xf[0].trim()
  return req.ip || 'unknown'
}

/** Limit per IP dla publicznego narzędzia (bez sesji). */
export function createIpRateLimit(maxHits: number, windowMs: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = `ip:${clientIp(req)}`
    const now = Date.now()
    const current = buckets.get(key)
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }
    if (current.count >= maxHits) {
      return next(
        new AppError('Za dużo zgłoszeń w krótkim czasie. Spróbuj za chwilę.', 429, 'RATE_LIMITED')
      )
    }
    current.count += 1
    buckets.set(key, current)
    return next()
  }
}
