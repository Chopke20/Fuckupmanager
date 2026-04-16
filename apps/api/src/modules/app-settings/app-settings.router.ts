import { Router } from 'express'
import {
  getAdminAppSettingsHandler,
  getPublicAppSettingsHandler,
  updateAppSettingsHandler,
} from './app-settings.controller'
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware'

const router = Router()

router.get('/public', getPublicAppSettingsHandler)
router.get('/admin', requireAuth, requirePermission('admin.users.read'), getAdminAppSettingsHandler)
router.put('/admin', requireAuth, requirePermission('admin.users.write'), updateAppSettingsHandler)

export default router
