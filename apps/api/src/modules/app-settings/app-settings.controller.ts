import { NextFunction, Request, Response } from 'express'
import { getAdminAppSettings, getPublicAppSettings, updateAppSettings } from './app-settings.service'

export async function getPublicAppSettingsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getPublicAppSettings()
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export async function getAdminAppSettingsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getAdminAppSettings()
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export async function updateAppSettingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await updateAppSettings(req.body)
    res.json(data)
  } catch (error) {
    next(error)
  }
}
