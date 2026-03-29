import { PERMISSIONS, Permission, resolvePermissionsForRole } from '@lama-stage/shared-types'
import { prisma } from '../../prisma/client'

function normalizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return []
  const allowed = new Set<string>(PERMISSIONS as readonly string[])
  const out: Permission[] = []
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    if (allowed.has(raw)) out.push(raw as Permission)
  }
  return Array.from(new Set(out))
}

export async function resolvePermissionsForRoleFromDb(role: string): Promise<Permission[]> {
  // Role wbudowane (ADMIN, OPERATOR_FULL) – uprawnienia zawsze z kodu, żeby nowe (np. admin.backup) trafiały do ADMIN bez edycji.
  const staticPermissions = resolvePermissionsForRole(role)
  if (staticPermissions.length > 0) return staticPermissions

  const roleDef = await prisma.roleDefinition.findUnique({ where: { roleKey: role } })
  if (!roleDef) return []
  try {
    const parsed = JSON.parse(roleDef.permissionsJson)
    const normalized = normalizePermissions(parsed)
    if (normalized.length > 0) return normalized
  } catch {
    // ignore broken JSON
  }
  return []
}

export async function hasPermissionForRole(role: string, permission: Permission): Promise<boolean> {
  const permissions = await resolvePermissionsForRoleFromDb(role)
  return permissions.includes(permission)
}
