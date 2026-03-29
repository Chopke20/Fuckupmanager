import { randomUUID } from 'crypto'
import { NextFunction, Request, Response } from 'express'

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.header('x-request-id') || randomUUID()
  res.locals.requestId = requestId
  res.setHeader('x-request-id', requestId)
  next()
}
