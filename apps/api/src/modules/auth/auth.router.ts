import { Router } from 'express'
import {
  acceptInvite,
  adminResetPassword,
  assignUserRole,
  createBackup,
  createInvitation,
  createRole,
  deleteRole,
  deactivateUser,
  forgotPassword,
  listInvitations,
  listAuditLogs,
  listRoles,
  listUsers,
  login,
  logout,
  me,
  resetPassword,
  updateRole,
} from './auth.controller'
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware'
import { createRateLimit } from './auth.rate-limit'

const router = Router()

router.post('/login', createRateLimit(10, 10 * 60 * 1000), login)
router.post('/forgot-password', createRateLimit(5, 10 * 60 * 1000), forgotPassword)
router.post('/reset-password', resetPassword)
router.post('/accept-invite', acceptInvite)

router.post('/logout', requireAuth, logout)
router.get('/me', requireAuth, me)

router.post('/invitations', requireAuth, requirePermission('admin.users.write'), createInvitation)
router.get('/invitations', requireAuth, requirePermission('admin.users.read'), listInvitations)

router.get('/admin/users', requireAuth, requirePermission('admin.users.read'), listUsers)
router.get('/admin/audit-logs', requireAuth, requirePermission('admin.audit.read'), listAuditLogs)
router.delete('/admin/users/:id', requireAuth, requirePermission('admin.users.write'), deactivateUser)
router.post('/admin/users/:id/reset-password', requireAuth, requirePermission('admin.users.write'), adminResetPassword)
router.patch('/admin/users/:id/role', requireAuth, requirePermission('admin.users.write'), assignUserRole)
router.get('/admin/roles', requireAuth, requirePermission('admin.roles.read'), listRoles)
router.post('/admin/roles', requireAuth, requirePermission('admin.roles.write'), createRole)
router.put('/admin/roles/:roleKey', requireAuth, requirePermission('admin.roles.write'), updateRole)
router.delete('/admin/roles/:roleKey', requireAuth, requirePermission('admin.roles.write'), deleteRole)
router.get('/admin/backup', requireAuth, requirePermission('admin.backup'), createBackup)

export default router
