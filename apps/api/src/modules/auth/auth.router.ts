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
  getAdminAppSettings,
  listPublicCompaniesHandler,
  listInvitations,
  listAuditLogs,
  listRoles,
  listUsers,
  login,
  logout,
  me,
  resetPassword,
  updateRole,
  updateAdminAppSettings,
} from './auth.controller'
import { bindCompanyContext, requireAuth, requirePermission } from '../../shared/middleware/auth.middleware'
import { createRateLimit } from './auth.rate-limit'

const router = Router()
const withAuth = [requireAuth, bindCompanyContext] as const
const LOGIN_WINDOW_MS = 10 * 60 * 1000
const PASSWORD_RESET_WINDOW_MS = 10 * 60 * 1000
const ACCEPT_INVITE_WINDOW_MS = 10 * 60 * 1000

router.get('/public-companies', listPublicCompaniesHandler)
router.post('/login', createRateLimit(10, LOGIN_WINDOW_MS), login)
router.post('/forgot-password', createRateLimit(5, PASSWORD_RESET_WINDOW_MS), forgotPassword)
router.post('/reset-password', createRateLimit(5, PASSWORD_RESET_WINDOW_MS), resetPassword)
router.post('/accept-invite', createRateLimit(10, ACCEPT_INVITE_WINDOW_MS), acceptInvite)

router.post('/logout', ...withAuth, logout)
router.get('/me', ...withAuth, me)

router.post('/invitations', ...withAuth, requirePermission('admin.users.write'), createInvitation)
router.get('/invitations', ...withAuth, requirePermission('admin.users.read'), listInvitations)

router.get('/admin/users', ...withAuth, requirePermission('admin.users.read'), listUsers)
router.get('/admin/audit-logs', ...withAuth, requirePermission('admin.audit.read'), listAuditLogs)
router.delete('/admin/users/:id', ...withAuth, requirePermission('admin.users.write'), deactivateUser)
router.post('/admin/users/:id/reset-password', ...withAuth, requirePermission('admin.users.write'), adminResetPassword)
router.patch('/admin/users/:id/role', ...withAuth, requirePermission('admin.users.write'), assignUserRole)
router.get('/admin/roles', ...withAuth, requirePermission('admin.roles.read'), listRoles)
router.post('/admin/roles', ...withAuth, requirePermission('admin.roles.write'), createRole)
router.put('/admin/roles/:roleKey', ...withAuth, requirePermission('admin.roles.write'), updateRole)
router.delete('/admin/roles/:roleKey', ...withAuth, requirePermission('admin.roles.write'), deleteRole)
router.get('/admin/app-settings', ...withAuth, requirePermission('admin.users.read'), getAdminAppSettings)
router.put('/admin/app-settings', ...withAuth, requirePermission('admin.users.write'), updateAdminAppSettings)
router.get('/admin/backup', ...withAuth, requirePermission('admin.backup'), createBackup)

export default router
