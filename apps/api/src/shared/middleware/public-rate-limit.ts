import type { Request } from 'express'
import { AppError } from '../errors/AppError'

type Bucket = { n: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0]!.trim()
  return req.ip || 'unknown'
}

/** Prosty licznik w pamięci procesu. Nie jest rozproszony — świadoma decyzja. */
export function assertRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now()
  const cur = buckets.get(key)
  if (!cur || cur.resetAt < now) {
    buckets.set(key, { n: 1, resetAt: now + windowMs })
    return
  }
  if (cur.n >= limit) {
    throw new AppError('Zbyt wiele żądań. Spróbuj za chwilę.', 429, 'RATE_LIMIT')
  }
  cur.n += 1
}
