import { Request, Response, NextFunction } from 'express'
import { NipLookupRequestSchema } from '@lama-stage/shared-types'
import { lookupCompanyByNipFromDataport } from './dataport.service'

export const postNipLookup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = NipLookupRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Nieprawidłowy NIP', code: 'VALIDATION_ERROR' } })
    }
    const data = await lookupCompanyByNipFromDataport(parsed.data.nip)
    res.json({ data })
  } catch (e) {
    next(e)
  }
}
