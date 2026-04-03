import { Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { AppError } from '../errors/AppError'

type ErrorResponseBody = {
  message: string
  code?: string
  details?: unknown
  field?: string
}

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = res.locals.requestId || req.header('x-request-id') || 'unknown'
  const logPayload = {
    level: 'error',
    requestId,
    method: req.method,
    path: req.originalUrl,
    name: err.name,
    message: err.message,
  }
  console.error(JSON.stringify(logPayload))

  if (err instanceof AppError) {
    const errorResponse: ErrorResponseBody = {
      message: err.message,
      code: err.code,
    }
    if (err.details !== undefined) {
      errorResponse.details = err.details
    }
    return res.status(err.statusCode).json({
      error: errorResponse,
      requestId,
    })
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    const isDev = process.env.NODE_ENV !== 'production'
    return res.status(400).json({
      error: {
        message: isDev ? err.message : 'Nieprawidłowe dane zapisu do bazy.',
        code: 'VALIDATION_ERROR',
      },
      requestId,
    })
  }

  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: {
          message: 'Zasób nie znaleziony',
          code: 'NOT_FOUND',
        },
        requestId,
      })
    }
    if (err.code === 'P2002') {
      const meta = err.meta
      const target = Array.isArray(meta?.target)
        ? (meta!.target as unknown[]).filter((t): t is string => typeof t === 'string')
        : undefined
      const isInternalCode = Boolean(target?.includes('internalCode'))
      const body: { message: string; code: string; field?: string } = {
        message: isInternalCode
          ? 'Kod wewnętrzny jest już używany przez inny sprzęt lub zasób.'
          : 'Konflikt danych - unikalne pole już istnieje',
        code: 'CONFLICT',
      }
      if (isInternalCode) body.field = 'internalCode'
      return res.status(409).json({
        error: body,
        requestId,
      })
    }
    if (err.code === 'P2021') {
      return res.status(503).json({
        error: {
          message:
            'Baza nie jest zsynchronizowana z aplikacją (brakuje tabel). Na serwerze: cd apps/api && npx prisma migrate deploy && pm2 restart lamaapp',
          code: 'DB_SCHEMA_OUT_OF_SYNC',
        },
        requestId,
      })
    }
    if (err.code === 'P2003') {
      return res.status(400).json({
        error: {
          message:
            'Błąd spójności danych (np. konto zapraszającego nie istnieje w bazie). Zaloguj się ponownie lub uruchom migracje Prisma.',
          code: 'FOREIGN_KEY_VIOLATION',
        },
        requestId,
      })
    }
    const isDevPrisma = process.env.NODE_ENV !== 'production'
    return res.status(500).json({
      error: {
        message: isDevPrisma ? err.message : `Błąd bazy danych (${err.code}). Szczegóły w logach PM2.`,
        code: err.code || 'DATABASE_ERROR',
      },
      requestId,
    })
  }

  // Default error (w development zwracaj szczegóły)
  const isDev = process.env.NODE_ENV !== 'production'
  res.status(500).json({
    error: {
      message: isDev ? (err.message || 'Wewnętrzny błąd serwera') : 'Wewnętrzny błąd serwera',
      code: 'INTERNAL_ERROR',
      ...(isDev && err.stack && { stack: err.stack }),
    },
    requestId,
  })
}