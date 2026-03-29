import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'
import { ValidationError } from '../errors/AppError'

export const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return next(new ValidationError(result.error.flatten()))
    }
    req.body = result.data
    next()
  }