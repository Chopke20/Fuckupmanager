import { NextFunction, Request, Response } from 'express'
import { AppError } from '../../shared/errors/AppError'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Limit per zalogowany użytkownik (+ firma), nie per IP. */
export function createUserRateLimit(maxHits: number, windowMs: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as { id?: string } | undefined
    const companyCode = typeof res.locals.companyCode === 'string' ? res.locals.companyCode : 'unknown'
    const key = `${companyCode}:${user?.id ?? 'anon'}`
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
