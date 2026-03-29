import { Router } from 'express'
import { requirePermission } from '../../shared/middleware/auth.middleware'
import {
  createIssuerProfileHandler,
  deleteIssuerProfileHandler,
  getDefaultIssuerProfileHandler,
  getIssuerProfileHandler,
  listIssuerProfilesHandler,
  setDefaultIssuerProfileHandler,
  updateIssuerProfileHandler,
} from './issuer-profiles.controller'

const router = Router()

const canReadOrders = requirePermission('orders.read')
const canManageProfiles = requirePermission('admin.users.write')

/** Lista i odczyt — wspólne źródło danych dla oferty i innych formularzy (czytanie jak zlecenia). */
router.get('/', canReadOrders, listIssuerProfilesHandler)
router.get('/default', canReadOrders, getDefaultIssuerProfileHandler)
router.get('/:id', canReadOrders, getIssuerProfileHandler)

/** Zmiany — wyłącznie panel Admin (nie `orders.write`). */
router.post('/', canManageProfiles, createIssuerProfileHandler)
router.patch('/:id', canManageProfiles, updateIssuerProfileHandler)
router.post('/:id/set-default', canManageProfiles, setDefaultIssuerProfileHandler)
router.delete('/:id', canManageProfiles, deleteIssuerProfileHandler)

export default router
