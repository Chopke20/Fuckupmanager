import { Router } from 'express'
import { requireAnyPermission } from '../../shared/middleware/auth.middleware'
import { postNipLookup } from './dataport.controller'

const router = Router()

router.post(
  '/lookup',
  requireAnyPermission('clients.write', 'orders.read', 'admin.users.write'),
  postNipLookup
)

export default router
