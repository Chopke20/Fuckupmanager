import { NextFunction, Request, Response } from 'express'
import { prisma } from '../../prisma/client'
import { AppError } from '../errors/AppError'
import { sha256 } from '../../modules/auth/auth.crypto'
import { Permission } from '@lama-stage/shared-types'
import { hasPermissionForRole } from '../../modules/auth/permissions.service'
import { getSessionCookieName, parseSessionCookieValue } from '../../modules/auth/auth.session'
import { runWithCompanyContext } from '../context/company-context'

function parseCookieValue(cookieHeader: string | undefined, key: string): string | null {
  if (!cookieHeader) return null
  const chunks = cookieHeader.split(';')
  for (const chunk of chunks) {
    const [rawKey, ...rest] = chunk.trim().split('=')
    if (rawKey === key) return decodeURIComponent(rest.join('='))
  }
  return null
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const rawCookieValue = parseCookieValue(req.headers.cookie, getSessionCookieName())
    const parsedCookie = parseSessionCookieValue(rawCookieValue)
    if (!parsedCookie) {
      throw new AppError('Brak sesji. Zaloguj się ponownie.', 401, 'UNAUTHORIZED')
    }
    const { companyCode, token } = parsedCookie
    const session = await runWithCompanyContext(companyCode, async () =>
      prisma.session.findFirst({
        where: {
          sessionTokenHash: sha256(token),
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: true,
        },
      })
    )

    if (!session || !session.user.isActive) {
      throw new AppError('Sesja wygasła. Zaloguj się ponownie.', 401, 'SESSION_EXPIRED')
    }

    await runWithCompanyContext(companyCode, async () =>
      prisma.session.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      })
    )

    res.locals.user = session.user
    res.locals.session = session
    res.locals.companyCode = companyCode
    next()
  } catch (error) {
    next(error)
  }
}

export function bindCompanyContext(req: Request, res: Response, next: NextFunction) {
  const companyCode = typeof res.locals.companyCode === 'string' ? res.locals.companyCode : null
  if (!companyCode) return next(new AppError('Brak kontekstu firmy.', 401, 'UNAUTHORIZED'))
  res.setHeader('X-Company-Code', companyCode)
  runWithCompanyContext(companyCode, async () => {
    next()
  }).catch(next)
}

export function requireRole(role: 'ADMIN') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as { role?: string } | undefined
    if (!user || user.role !== role) {
      return next(new AppError('Brak uprawnień do tej operacji.', 403, 'FORBIDDEN'))
    }
    next()
  }
}

export function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as { role?: string } | undefined
    const allowed = user?.role ? await hasPermissionForRole(user.role, permission) : false
    if (!allowed) {
      return next(new AppError('Brak uprawnień do tej operacji.', 403, 'FORBIDDEN'))
    }
    next()
  }
}

/** Użytkownik musi mieć co najmniej jedno z podanych uprawnień (np. lookup NIP dla klientów i zleceń). */
export function requireAnyPermission(...permissions: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as { role?: string } | undefined
    if (!user?.role) {
      return next(new AppError('Brak uprawnień do tej operacji.', 403, 'FORBIDDEN'))
    }
    for (const p of permissions) {
      if (await hasPermissionForRole(user.role, p)) {
        return next()
      }
    }
    return next(new AppError('Brak uprawnień do tej operacji.', 403, 'FORBIDDEN'))
  }
}

export function requireModuleAccess(moduleName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') return next()
    const action = req.method === 'GET' || req.method === 'HEAD' ? 'read' : 'write'
    const permission = `${moduleName}.${action}` as Permission
    const user = res.locals.user as { role?: string } | undefined
    const allowed = user?.role ? await hasPermissionForRole(user.role, permission) : false
    if (!allowed) {
      return next(new AppError('Brak uprawnień do tego modułu.', 403, 'FORBIDDEN'))
    }
    next()
  }
}
