import { NextFunction, Request, Response } from 'express'
import { AppError, ValidationError } from '../../shared/errors/AppError'
import { assertSmtpMailConfigured } from '../auth/smtp.mailer'
import { buildBugReportTicketId, sendBugReportMail } from './feedback.mail'

const ALLOWED_TYPES = new Set(['broken', 'wrong', 'missing', 'ugly'])
const ALLOWED_URGENCY = new Set(['fire', 'ok', 'someday'])
const MIN_MESSAGE = 15
const MAX_MESSAGE = 4000

function asString(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function asFiniteInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.round(n))
}

function sanitizeFailures(raw: unknown) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 5).map((row) => {
    const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    return {
      at: asString(r.at, 40) || new Date().toISOString(),
      method: asString(r.method, 12) || 'GET',
      url: asString(r.url, 240) || '(unknown)',
      status: typeof r.status === 'number' && Number.isFinite(r.status) ? r.status : null,
      requestId: typeof r.requestId === 'string' ? r.requestId.slice(0, 80) : null,
      message: asString(r.message, 240) || '',
    }
  })
}

function sanitizeConsole(raw: unknown) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 5).map((row) => {
    const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    return {
      at: asString(r.at, 40) || new Date().toISOString(),
      message: asString(r.message, 240) || '',
    }
  })
}

export async function postBugReport(req: Request, res: Response, next: NextFunction) {
  try {
    assertSmtpMailConfigured()

    const user = res.locals.user as
      | { id?: string; email?: string; fullName?: string | null; role?: string }
      | undefined
    const companyCode = typeof res.locals.companyCode === 'string' ? res.locals.companyCode : ''
    if (!user?.email || !companyCode) {
      throw new AppError('Brak sesji użytkownika.', 401, 'UNAUTHORIZED')
    }

    const body = (req.body ?? {}) as Record<string, unknown>
    const message = asString(body.message, MAX_MESSAGE)
    const type = asString(body.type, 32)
    const urgency = asString(body.urgency, 32)

    if (message.length < MIN_MESSAGE) {
      throw new ValidationError({ message: `Opis musi mieć co najmniej ${MIN_MESSAGE} znaków.` })
    }
    if (!ALLOWED_TYPES.has(type)) {
      throw new ValidationError({ type: 'Nieprawidłowy typ zgłoszenia.' })
    }
    if (!ALLOWED_URGENCY.has(urgency)) {
      throw new ValidationError({ urgency: 'Nieprawidłowa pilność.' })
    }

    const viewportRaw = body.viewport && typeof body.viewport === 'object' ? (body.viewport as Record<string, unknown>) : {}
    const ticketId = buildBugReportTicketId()
    const userName = (user.fullName && user.fullName.trim()) || user.email

    await sendBugReportMail({
      ticketId,
      type,
      urgency,
      companyCode,
      uiVersion: asString(body.uiVersion, 64) || 'main-unknown',
      userName,
      userEmail: user.email,
      userRole: user.role || 'UNKNOWN',
      pageTitle: asString(body.pageTitle, 160) || 'Lama',
      pathname: asString(body.pathname, 240) || '/',
      moduleLabel: asString(body.moduleLabel, 80) || 'Ekran',
      message,
      timestampIso: new Date().toISOString(),
      minutesOnPage: asFiniteInt(body.minutesOnPage, 0),
      viewport: {
        width: asFiniteInt(viewportRaw.width, 0),
        height: asFiniteInt(viewportRaw.height, 0),
      },
      userAgent: asString(body.userAgent, 320) || asString(req.headers['user-agent'], 320),
      apiFailures: sanitizeFailures(body.apiFailures),
      consoleErrors: sanitizeConsole(body.consoleErrors),
      spinaczAside: asString(body.spinaczAside, 240) || 'Przyjąłem bez oporu.',
    })

    res.status(201).json({ ok: true as const, ticketId })
  } catch (error) {
    next(error)
  }
}
