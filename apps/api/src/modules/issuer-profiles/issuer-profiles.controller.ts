import { Request, Response, NextFunction } from 'express'
import {
  createIssuerProfile,
  deleteIssuerProfile,
  getDefaultIssuerProfile,
  getIssuerProfileById,
  listIssuerProfiles,
  setDefaultIssuerProfile,
  updateIssuerProfile,
} from './issuer-profiles.service'

export const listIssuerProfilesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await listIssuerProfiles(req.query as Record<string, unknown>)
    res.json(result)
  } catch (e) {
    next(e)
  }
}

export const getIssuerProfileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(400).json({ error: { message: 'Brak ID', code: 'VALIDATION_ERROR' } })
    }
    const data = await getIssuerProfileById(id)
    res.json({ data })
  } catch (e) {
    next(e)
  }
}

export const getDefaultIssuerProfileHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getDefaultIssuerProfile()
    res.json({ data })
  } catch (e) {
    next(e)
  }
}

export const createIssuerProfileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await createIssuerProfile(req.body)
    res.status(201).json({ data })
  } catch (e) {
    next(e)
  }
}

export const updateIssuerProfileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(400).json({ error: { message: 'Brak ID', code: 'VALIDATION_ERROR' } })
    }
    const data = await updateIssuerProfile(id, req.body)
    res.json({ data })
  } catch (e) {
    next(e)
  }
}

export const setDefaultIssuerProfileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(400).json({ error: { message: 'Brak ID', code: 'VALIDATION_ERROR' } })
    }
    const data = await setDefaultIssuerProfile(id)
    res.json({ data })
  } catch (e) {
    next(e)
  }
}

export const deleteIssuerProfileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(400).json({ error: { message: 'Brak ID', code: 'VALIDATION_ERROR' } })
    }
    const data = await deleteIssuerProfile(id)
    res.json({ data })
  } catch (e) {
    next(e)
  }
}
