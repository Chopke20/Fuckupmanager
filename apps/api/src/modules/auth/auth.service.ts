import type { User } from '@prisma/client'
import { AppError } from '../../shared/errors/AppError'
import { prisma } from '../../prisma/client'
import { hashPassword, randomToken, sha256, verifyPassword } from './auth.crypto'
import { sendInviteEmail, sendPasswordResetEmail } from './auth.mail'
import { assertSmtpMailConfigured } from './smtp.mailer'
import {
  CreateRoleDefinitionSchema,
  PERMISSIONS,
  Permission,
  ROLE_PERMISSION_MAP,
  resolvePermissionsForRole,
  UpdateRoleDefinitionSchema,
} from '@lama-stage/shared-types'
import { resolvePermissionsForRoleFromDb } from './permissions.service'

const INVITE_TTL_HOURS = Number(process.env.INVITE_TTL_HOURS ?? 48)
const RESET_TTL_MINUTES = Number(process.env.RESET_TTL_MINUTES ?? 60)
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 14)
const SESSION_COOKIE_NAME = 'lama_session'

export type SafeUser = {
  id: string
  username: string | null
  email: string
  fullName: string | null
  role: string
  isActive: boolean
  mustChangePassword: boolean
  emailVerifiedAt: Date | null
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
  permissions?: Permission[]
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

function normalizePermissionList(input: unknown): Permission[] {
  if (!Array.isArray(input)) return []
  const allowed = new Set<string>(PERMISSIONS as readonly string[])
  const values = input.filter((item): item is string => typeof item === 'string' && allowed.has(item))
  return Array.from(new Set(values as Permission[]))
}

function parsePermissionsJson(value: string): Permission[] {
  try {
    return normalizePermissionList(JSON.parse(value))
  } catch {
    return []
  }
}

function futureDate(hoursOrDays: number, unit: 'hours' | 'minutes' | 'days'): Date {
  const now = new Date()
  const multiplier = unit === 'minutes' ? 60_000 : unit === 'hours' ? 3_600_000 : 86_400_000
  return new Date(now.getTime() + hoursOrDays * multiplier)
}

export class AuthService {
  getSessionCookieName() {
    return SESSION_COOKIE_NAME
  }

  getSessionCookieOptions() {
    const isProd = process.env.NODE_ENV === 'production'
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isProd,
      path: '/',
      expires: futureDate(SESSION_TTL_DAYS, 'days'),
    }
  }

  async login(email: string, password: string, userAgent?: string, ipAddress?: string) {
    const normalizedEmail = normalizeEmail(email)
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user || !user.isActive) {
      throw new AppError('Nieprawidłowy e-mail lub hasło.', 401, 'INVALID_CREDENTIALS')
    }
    if (!user.emailVerifiedAt) {
      throw new AppError('Konto nie zostało jeszcze aktywowane.', 403, 'EMAIL_NOT_VERIFIED')
    }
    if (!verifyPassword(password, user.passwordHash)) {
      throw new AppError('Nieprawidłowy e-mail lub hasło.', 401, 'INVALID_CREDENTIALS')
    }

    const sessionToken = randomToken()
    await prisma.session.create({
      data: {
        sessionTokenHash: sha256(sessionToken),
        userId: user.id,
        userAgent: userAgent ?? null,
        ipAddress: ipAddress ?? null,
        expiresAt: futureDate(SESSION_TTL_DAYS, 'days'),
      },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const permissions = await resolvePermissionsForRoleFromDb(user.role)
    return {
      sessionToken,
      user: {
        ...toSafeUser(user),
        permissions,
      },
    }
  }

  async logoutByToken(rawToken: string | null) {
    if (!rawToken) return
    await prisma.session.updateMany({
      where: {
        sessionTokenHash: sha256(rawToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.isActive) {
      throw new AppError('Nie znaleziono użytkownika.', 404, 'USER_NOT_FOUND')
    }
    const permissions = await resolvePermissionsForRoleFromDb(user.role)
    return { ...toSafeUser(user), permissions }
  }

  async forgotPassword(email: string) {
    const normalizedEmail = normalizeEmail(email)
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user || !user.isActive) {
      return
    }

    assertSmtpMailConfigured()
    const rawToken = randomToken()
    const resetRow = await prisma.passwordResetToken.create({
      data: {
        tokenHash: sha256(rawToken),
        userId: user.id,
        expiresAt: futureDate(RESET_TTL_MINUTES, 'minutes'),
      },
    })
    try {
      await sendPasswordResetEmail(user.email, rawToken)
    } catch (err) {
      await prisma.passwordResetToken.delete({ where: { id: resetRow.id } }).catch(() => {})
      throw err
    }
  }

  async resetPassword(token: string, password: string) {
    const tokenHash = sha256(token)
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
    if (!resetToken) {
      throw new AppError('Link resetu jest nieprawidłowy lub wygasł.', 400, 'RESET_TOKEN_INVALID')
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash: hashPassword(password),
          mustChangePassword: false,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.session.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])
  }

  async createInvitation(
    invitedByUserId: string,
    email: string,
    role: string,
    fullName?: string
  ) {
    const normalizedEmail = normalizeEmail(email)
    const rawToken = randomToken()
    const isBuiltIn = resolvePermissionsForRole(role).length > 0
    const customRole = isBuiltIn ? null : await prisma.roleDefinition.findUnique({ where: { roleKey: role } })
    if (!isBuiltIn && !customRole) {
      throw new AppError('Wybrana rola nie istnieje.', 404, 'ROLE_NOT_FOUND')
    }

    assertSmtpMailConfigured()

    const invitation = await prisma.invitationToken.create({
      data: {
        tokenHash: sha256(rawToken),
        email: normalizedEmail,
        role,
        fullName: fullName?.trim() || null,
        expiresAt: futureDate(INVITE_TTL_HOURS, 'hours'),
        invitedById: invitedByUserId,
      },
    })

    try {
      await sendInviteEmail(normalizedEmail, rawToken)
    } catch (err) {
      await prisma.invitationToken.delete({ where: { id: invitation.id } }).catch(() => {})
      throw err
    }
  }

  async acceptInvitation(token: string, password: string, userAgent?: string, ipAddress?: string) {
    const invite = await prisma.invitationToken.findFirst({
      where: {
        tokenHash: sha256(token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
    if (!invite) {
      throw new AppError('Zaproszenie jest nieprawidłowe lub wygasło.', 400, 'INVITE_INVALID')
    }

    const existing = await prisma.user.findUnique({ where: { email: invite.email } })
    let userId = existing?.id

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.user.update({
          where: { id: existing.id },
          data: {
            passwordHash: hashPassword(password),
            role: invite.role,
            fullName: invite.fullName ?? existing.fullName,
            isActive: true,
            emailVerifiedAt: new Date(),
            mustChangePassword: false,
          },
        })
        userId = existing.id
      } else {
        const created = await tx.user.create({
          data: {
            email: invite.email,
            username: invite.email.split('@')[0] ?? null,
            fullName: invite.fullName ?? null,
            role: invite.role,
            isActive: true,
            emailVerifiedAt: new Date(),
            mustChangePassword: false,
            passwordHash: hashPassword(password),
            createdById: invite.invitedById,
          },
        })
        userId = created.id
      }

      await tx.invitationToken.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      })
    })

    if (!userId) {
      throw new AppError('Nie udało się aktywować konta.', 500, 'INVITE_ACCEPT_FAILED')
    }

    const { sessionToken, user } = await this.login(invite.email, password, userAgent, ipAddress)
    return { sessionToken, user }
  }

  async listInvitations(page = 1, limit = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20
    const skip = (safePage - 1) * safeLimit
    const [items, total] = await prisma.$transaction([
      prisma.invitationToken.findMany({
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invitationToken.count(),
    ])
    return {
      data: items,
      meta: { total, page: safePage, lastPage: Math.max(1, Math.ceil(total / safeLimit)) },
    }
  }

  async listUsers(page = 1, limit = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20
    const skip = (safePage - 1) * safeLimit
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ])
    const data = await Promise.all(
      items.map(async (item) => ({
        ...toSafeUser(item),
        permissions: await resolvePermissionsForRoleFromDb(item.role),
      }))
    )
    return {
      data,
      meta: { total, page: safePage, lastPage: Math.max(1, Math.ceil(total / safeLimit)) },
    }
  }

  async listAuditLogs(page = 1, limit = 50) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 50
    const skip = (safePage - 1) * safeLimit
    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count(),
    ])
    return {
      data: items,
      meta: { total, page: safePage, lastPage: Math.max(1, Math.ceil(total / safeLimit)) },
    }
  }

  async deactivateUser(targetUserId: string, currentUserId: string) {
    if (targetUserId === currentUserId) {
      throw new AppError('Nie możesz dezaktywować własnego konta.', 400, 'CANNOT_DELETE_SELF')
    }
    await prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: false },
    })
    await prisma.session.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  async resetPasswordByAdmin(targetUserId: string) {
    const user = await prisma.user.findUnique({ where: { id: targetUserId } })
    if (!user || !user.isActive) {
      throw new AppError('Użytkownik nie istnieje lub jest nieaktywny.', 404, 'USER_NOT_FOUND')
    }
    assertSmtpMailConfigured()
    const rawToken = randomToken()
    const resetRow = await prisma.passwordResetToken.create({
      data: {
        tokenHash: sha256(rawToken),
        userId: user.id,
        expiresAt: futureDate(RESET_TTL_MINUTES, 'minutes'),
      },
    })
    try {
      await sendPasswordResetEmail(user.email, rawToken)
    } catch (err) {
      await prisma.passwordResetToken.delete({ where: { id: resetRow.id } }).catch(() => {})
      throw err
    }
  }

  async listRoles() {
    const rows = await prisma.roleDefinition.findMany({ orderBy: [{ isSystem: 'desc' }, { roleKey: 'asc' }] })
    const dbRoles = rows.map((row) => {
      const staticPerms = resolvePermissionsForRole(row.roleKey)
      const permissions = staticPerms.length > 0 ? staticPerms : parsePermissionsJson(row.permissionsJson)
      return {
        id: row.id,
        roleKey: row.roleKey,
        displayName: row.displayName,
        description: row.description,
        permissions,
        isSystem: row.isSystem,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    })
    const existingKeys = new Set(dbRoles.map((r) => r.roleKey))
    const fallbackSystemRoles = Object.entries(ROLE_PERMISSION_MAP)
      .filter(([roleKey]) => !existingKeys.has(roleKey))
      .map(([roleKey, permissions]) => ({
        id: `system-${roleKey.toLowerCase()}`,
        roleKey,
        displayName: roleKey === 'ADMIN' ? 'Administrator' : 'Operator (pełny)',
        description: roleKey === 'ADMIN'
          ? 'Pełne uprawnienia systemowe'
          : 'Pełny dostęp operacyjny bez panelu admin',
        permissions,
        isSystem: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }))
    return {
      data: [...dbRoles, ...fallbackSystemRoles].map((row) => ({
        id: row.id,
        roleKey: row.roleKey,
        displayName: row.displayName,
        description: row.description,
        permissions: row.permissions,
        isSystem: row.isSystem,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    }
  }

  async createRole(payload: unknown) {
    const parsed = CreateRoleDefinitionSchema.safeParse(payload)
    if (!parsed.success) {
      throw new AppError('Nieprawidłowe dane roli.', 400, 'VALIDATION_ERROR', parsed.error.flatten())
    }
    const { roleKey, displayName, description, permissions } = parsed.data
    if (resolvePermissionsForRole(roleKey).length > 0) {
      throw new AppError('Ta rola jest systemowa i już istnieje.', 409, 'ROLE_EXISTS')
    }
    const created = await prisma.roleDefinition.create({
      data: {
        roleKey,
        displayName,
        description: description ?? null,
        permissionsJson: JSON.stringify(normalizePermissionList(permissions)),
        isSystem: false,
      },
    })
    return {
      data: {
        id: created.id,
        roleKey: created.roleKey,
        displayName: created.displayName,
        description: created.description,
        permissions: parsePermissionsJson(created.permissionsJson),
        isSystem: created.isSystem,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    }
  }

  async updateRole(roleKey: string, payload: unknown) {
    const parsed = UpdateRoleDefinitionSchema.safeParse(payload)
    if (!parsed.success) {
      throw new AppError('Nieprawidłowe dane roli.', 400, 'VALIDATION_ERROR', parsed.error.flatten())
    }
    const row = await prisma.roleDefinition.findUnique({ where: { roleKey } })
    if (!row) throw new AppError('Rola nie istnieje.', 404, 'ROLE_NOT_FOUND')
    if (row.isSystem) {
      throw new AppError('Ról systemowych nie można edytować.', 400, 'SYSTEM_ROLE_READONLY')
    }
    const nextPermissions = parsed.data.permissions
      ? normalizePermissionList(parsed.data.permissions)
      : parsePermissionsJson(row.permissionsJson)
    const updated = await prisma.roleDefinition.update({
      where: { roleKey },
      data: {
        displayName: parsed.data.displayName ?? row.displayName,
        description: parsed.data.description === undefined ? row.description : parsed.data.description,
        permissionsJson: JSON.stringify(nextPermissions),
      },
    })
    return {
      data: {
        id: updated.id,
        roleKey: updated.roleKey,
        displayName: updated.displayName,
        description: updated.description,
        permissions: nextPermissions,
        isSystem: updated.isSystem,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    }
  }

  async deleteRole(roleKey: string) {
    const row = await prisma.roleDefinition.findUnique({ where: { roleKey } })
    if (!row) throw new AppError('Rola nie istnieje.', 404, 'ROLE_NOT_FOUND')
    if (row.isSystem) {
      throw new AppError('Ról systemowych nie można usuwać.', 400, 'SYSTEM_ROLE_READONLY')
    }
    const usersCount = await prisma.user.count({ where: { role: roleKey } })
    if (usersCount > 0) {
      throw new AppError('Nie można usunąć roli przypisanej do użytkowników.', 400, 'ROLE_IN_USE')
    }
    await prisma.roleDefinition.delete({ where: { roleKey } })
  }

  async assignRoleToUser(targetUserId: string, roleKey: string) {
    const target = await prisma.user.findUnique({ where: { id: targetUserId } })
    if (!target || !target.isActive) {
      throw new AppError('Użytkownik nie istnieje lub jest nieaktywny.', 404, 'USER_NOT_FOUND')
    }
    const isBuiltIn = resolvePermissionsForRole(roleKey).length > 0
    const custom = isBuiltIn ? null : await prisma.roleDefinition.findUnique({ where: { roleKey } })
    if (!isBuiltIn && !custom) {
      throw new AppError('Rola nie istnieje.', 404, 'ROLE_NOT_FOUND')
    }
    await prisma.user.update({
      where: { id: targetUserId },
      data: { role: roleKey },
    })
  }
}

export const authService = new AuthService()
