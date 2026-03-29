import { Request, Response, NextFunction } from 'express'
import { AppError } from '../errors/AppError'

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
    const errorResponse: any = {
      message: err.message,
      code: err.code,
    }
    if (err.details) {
      errorResponse.details = err.details
    }
    return res.status(err.statusCode).json({
      error: errorResponse,
      requestId,
    })
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    // @ts-ignore
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: {
          message: 'Zasób nie znaleziony',
          code: 'NOT_FOUND',
        },
        requestId,
      })
    }
    // @ts-ignore
    if (err.code === 'P2002') {
      const target = (err as any).meta?.target as string[] | undefined
      const isInternalCode = Array.isArray(target) && target.includes('internalCode')
      return res.status(409).json({
        error: {
          message: isInternalCode ? 'Kod wewnętrzny jest już używany przez inny sprzęt lub zasób.' : 'Konflikt danych - unikalne pole już istnieje',
          code: 'CONFLICT',
          ...(isInternalCode && { field: 'internalCode' }),
        },
        requestId,
      })
    }
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