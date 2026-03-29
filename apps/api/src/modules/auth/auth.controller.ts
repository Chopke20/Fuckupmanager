import { NextFunction, Request, Response } from 'express'
import {
  AcceptInviteRequestSchema,
  CreateInvitationRequestSchema,
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  ResetPasswordRequestSchema,
} from '@lama-stage/shared-types'
import { AppError } from '../../shared/errors/AppError'
import { createDatabaseBackup } from './backup.service'
import { authService } from './auth.service'
import { writeAuditLog } from './audit.service'

function getCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return null
}

function getClientIp(req: Request): string | undefined {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string') return xff.split(',')[0]?.trim()
  return req.socket.remoteAddress
}

type ActorContext = {
  id: string
  email: string
}

function getActor(res: Response): ActorContext | null {
  const user = res.locals.user as { id?: string; email?: string } | undefined
  if (!user?.id || !user?.email) return null
  return { id: user.id, email: user.email }
}

async function auditAdminAction(
  req: Request,
  res: Response,
  params: {
    module: string
    action: string
    targetType?: string
    targetId?: string
    result: 'SUCCESS' | 'FAILURE'
    details?: string
  }
) {
  const actor = getActor(res)
  if (!actor) return
  await writeAuditLog({
    actorUserId: actor.id,
    actorEmail: actor.email,
    module: params.module,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    result: params.result,
    details: params.details,
    requestId: res.locals.requestId || req.header('x-request-id') || null,
    ipAddress: getClientIp(req) || null,
    userAgent: req.headers['user-agent'] || null,
  })
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = LoginRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('Nieprawidłowe dane logowania.', 400, 'VALIDATION_ERROR', parsed.error.flatten())
    }
    const { sessionToken, user } = await authService.login(
      parsed.data.email,
      parsed.data.password,
      req.headers['user-agent'],
      getClientIp(req)
    )

    res.cookie(authService.getSessionCookieName(), sessionToken, authService.getSessionCookieOptions())
    res.json({ data: user })
  } catch (error) {
    next(error)
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const cookieName = authService.getSessionCookieName()
    const token = getCookie(req, cookieName)
    await authService.logoutByToken(token)
    res.clearCookie(cookieName, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    res.json({ data: { success: true } })
  } catch (error) {
    next(error)
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user as { id: string } | undefined
    if (!user?.id) {
      throw new AppError('Brak sesji.', 401, 'UNAUTHORIZED')
    }
    const data = await authService.me(user.id)
    res.json({ data })
  } catch (error) {
    next(error)
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = ForgotPasswordRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('Nieprawidłowy e-mail.', 400, 'VALIDATION_ERROR', parsed.error.flatten())
    }
    await authService.forgotPassword(parsed.data.email)
    res.json({ data: { success: true } })
  } catch (error) {
    next(error)
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = ResetPasswordRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('Nieprawidłowe dane resetu hasła.', 400, 'VALIDATION_ERROR', parsed.error.flatten())
    }
    await authService.resetPassword(parsed.data.token, parsed.data.password)
    res.json({ data: { success: true } })
  } catch (error) {
    next(error)
  }
}

export async function acceptInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = AcceptInviteRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('Nieprawidłowe dane aktywacji konta.', 400, 'VALIDATION_ERROR', parsed.error.flatten())
    }
    const { sessionToken, user } = await authService.acceptInvitation(
      parsed.data.token,
      parsed.data.password,
      req.headers['user-agent'],
      getClientIp(req)
    )
    res.cookie(authService.getSessionCookieName(), sessionToken, authService.getSessionCookieOptions())
    res.json({ data: user })
  } catch (error) {
    next(error)
  }
}

export async function createInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = CreateInvitationRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('Nieprawidłowe dane zaproszenia.', 400, 'VALIDATION_ERROR', parsed.error.flatten())
    }
    const currentUser = res.locals.user as { id: string } | undefined
    if (!currentUser?.id) {
      throw new AppError('Brak sesji.', 401, 'UNAUTHORIZED')
    }
    await authService.createInvitation(
      currentUser.id,
      parsed.data.email,
      parsed.data.role,
      parsed.data.fullName
    )
    await auditAdminAction(req, res, {
      module: 'admin.users',
      action: 'invite.create',
      targetType: 'UserInvitation',
      targetId: parsed.data.email.toLowerCase(),
      result: 'SUCCESS',
      details: `role=${parsed.data.role}`,
    })
    res.status(201).json({ data: { success: true } })
  } catch (error) {
    await auditAdminAction(req, res, {
      module: 'admin.users',
      action: 'invite.create',
      targetType: 'UserInvitation',
      targetId: typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : undefined,
      result: 'FAILURE',
      details: (error as Error).message,
    })
    next(error)
  }
}

export async function listInvitations(req: Request, res: Response, next: NextFunction) {
  try {
    const page = req.query.page != null ? Number(req.query.page) : 1
    const limit = req.query.limit != null ? Number(req.query.limit) : 20
    const list = await authService.listInvitations(page, limit)
    res.json(list)
  } catch (error) {
    next(error)
  }
}

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = req.query.page != null ? Number(req.query.page) : 1
    const limit = req.query.limit != null ? Number(req.query.limit) : 20
    const list = await authService.listUsers(page, limit)
    res.json(list)
  } catch (error) {
    next(error)
  }
}

export async function listAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const page = req.query.page != null ? Number(req.query.page) : 1
    const limit = req.query.limit != null ? Number(req.query.limit) : 50
    const list = await authService.listAuditLogs(page, limit)
    res.json(list)
  } catch (error) {
    next(error)
  }
}

export async function deactivateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    if (!id) throw new AppError('Brak ID użytkownika.', 400, 'VALIDATION_ERROR')
    const currentUser = res.locals.user as { id: string } | undefined
    if (!currentUser?.id) throw new AppError('Brak sesji.', 401, 'UNAUTHORIZED')
    await authService.deactivateUser(id, currentUser.id)
    await auditAdminAction(req, res, {
      module: 'admin.users',
      action: 'user.deactivate',
      targetType: 'User',
      targetId: id,
      result: 'SUCCESS',
    })
    res.json({ data: { success: true } })
  } catch (error) {
    await auditAdminAction(req, res, {
      module: 'admin.users',
      action: 'user.deactivate',
      targetType: 'User',
      targetId: req.params.id,
      result: 'FAILURE',
      details: (error as Error).message,
    })
    next(error)
  }
}

export async function adminResetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    if (!id) throw new AppError('Brak ID użytkownika.', 400, 'VALIDATION_ERROR')
    await authService.resetPasswordByAdmin(id)
    await auditAdminAction(req, res, {
      module: 'admin.users',
      action: 'user.password_reset',
      targetType: 'User',
      targetId: id,
      result: 'SUCCESS',
    })
    res.json({ data: { success: true } })
  } catch (error) {
    await auditAdminAction(req, res, {
      module: 'admin.users',
      action: 'user.password_reset',
      targetType: 'User',
      targetId: req.params.id,
      result: 'FAILURE',
      details: (error as Error).message,
    })
    next(error)
  }
}

export async function listRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const list = await authService.listRoles()
    res.json(list)
  } catch (error) {
    next(error)
  }
}

export async function createRole(req: Request, res: Response, next: NextFunction) {
  try {
    const created = await authService.createRole(req.body)
    await auditAdminAction(req, res, {
      module: 'admin.roles',
      action: 'role.create',
      targetType: 'Role',
      targetId: created.data.roleKey,
      result: 'SUCCESS',
    })
    res.status(201).json(created)
  } catch (error) {
    await auditAdminAction(req, res, {
      module: 'admin.roles',
      action: 'role.create',
      targetType: 'Role',
      targetId: typeof req.body?.roleKey === 'string' ? req.body.roleKey : undefined,
      result: 'FAILURE',
      details: (error as Error).message,
    })
    next(error)
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const roleKey = req.params.roleKey
    if (!roleKey) throw new AppError('Brak roleKey.', 400, 'VALIDATION_ERROR')
    const updated = await authService.updateRole(roleKey, req.body)
    await auditAdminAction(req, res, {
      module: 'admin.roles',
      action: 'role.update',
      targetType: 'Role',
      targetId: roleKey,
      result: 'SUCCESS',
    })
    res.json(updated)
  } catch (error) {
    await auditAdminAction(req, res, {
      module: 'admin.roles',
      action: 'role.update',
      targetType: 'Role',
      targetId: req.params.roleKey,
      result: 'FAILURE',
      details: (error as Error).message,
    })
    next(error)
  }
}

export async function deleteRole(req: Request, res: Response, next: NextFunction) {
  try {
    const roleKey = req.params.roleKey
    if (!roleKey) throw new AppError('Brak roleKey.', 400, 'VALIDATION_ERROR')
    await authService.deleteRole(roleKey)
    await auditAdminAction(req, res, {
      module: 'admin.roles',
      action: 'role.delete',
      targetType: 'Role',
      targetId: roleKey,
      result: 'SUCCESS',
    })
    res.json({ data: { success: true } })
  } catch (error) {
    await auditAdminAction(req, res, {
      module: 'admin.roles',
      action: 'role.delete',
      targetType: 'Role',
      targetId: req.params.roleKey,
      result: 'FAILURE',
      details: (error as Error).message,
    })
    next(error)
  }
}

export async function assignUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.id
    const role = typeof req.body?.role === 'string' ? req.body.role : ''
    if (!userId || !role) throw new AppError('Brak danych zmiany roli.', 400, 'VALIDATION_ERROR')
    await authService.assignRoleToUser(userId, role)
    await auditAdminAction(req, res, {
      module: 'admin.users',
      action: 'user.role_assign',
      targetType: 'User',
      targetId: userId,
      result: 'SUCCESS',
      details: `role=${role}`,
    })
    res.json({ data: { success: true } })
  } catch (error) {
    await auditAdminAction(req, res, {
      module: 'admin.users',
      action: 'user.role_assign',
      targetType: 'User',
      targetId: req.params.id,
      result: 'FAILURE',
      details: (error as Error).message,
    })
    next(error)
  }
}

export async function createBackup(req: Request, res: Response, next: NextFunction) {
  try {
    const { buffer, filename, copiedToDir } = await createDatabaseBackup()
    await auditAdminAction(req, res, {
      module: 'admin.backup',
      action: 'backup.create',
      targetType: 'Database',
      result: 'SUCCESS',
      details: copiedToDir ? `Pobrano i zapisano do ${copiedToDir}` : 'Pobrano kopię',
    })
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', String(buffer.length))
    res.send(buffer)
  } catch (error) {
    await auditAdminAction(req, res, {
      module: 'admin.backup',
      action: 'backup.create',
      targetType: 'Database',
      result: 'FAILURE',
      details: (error as Error).message,
    })
    next(error)
  }
}
