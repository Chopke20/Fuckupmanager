import {
  AppSettings,
  AppSettingsSchema,
  AuditLog,
  CreateRoleDefinitionSchema,
  Permission,
  PublicCompanySchema,
  RoleDefinitionSchema,
  UpdateRoleDefinitionSchema,
  UserPublic,
} from '@lama-stage/shared-types'
import axiosInstance, { api } from '../../shared/api/client'

type Envelope<T> = { data: T }
type Paginated<T> = { data: T[]; meta: { total: number; page: number; lastPage: number } }

export type PublicCompany = {
  code: string
  displayName: string
  logoDarkBgUrl?: string | null
  logoLightBgUrl?: string | null
  loginHelpText?: string | null
}

export async function apiListPublicCompanies(): Promise<PublicCompany[]> {
  const res = await api.get<Envelope<unknown[]>>('/auth/public-companies')
  return (res.data ?? []).map((row) => PublicCompanySchema.parse(row))
}

export async function apiLogin(companyCode: string, email: string, password: string): Promise<UserPublic> {
  const res = await api.post<Envelope<UserPublic>>('/auth/login', { companyCode, email, password })
  return res.data
}

export async function apiLogout(): Promise<void> {
  await api.post<Envelope<{ success: boolean }>>('/auth/logout')
}

export async function apiMe(): Promise<UserPublic> {
  const res = await api.get<Envelope<UserPublic>>('/auth/me')
  return res.data
}

export async function apiForgotPassword(companyCode: string, email: string): Promise<void> {
  await api.post<Envelope<{ success: boolean }>>('/auth/forgot-password', { companyCode, email })
}

export async function apiResetPassword(companyCode: string, token: string, password: string, passwordConfirm: string): Promise<void> {
  await api.post<Envelope<{ success: boolean }>>('/auth/reset-password', { companyCode, token, password, passwordConfirm })
}

export async function apiAcceptInvite(companyCode: string, token: string, password: string, passwordConfirm: string): Promise<UserPublic> {
  const res = await api.post<Envelope<UserPublic>>('/auth/accept-invite', { companyCode, token, password, passwordConfirm })
  return res.data
}

export async function apiListUsers(page = 1, limit = 50): Promise<Paginated<UserPublic>> {
  return api.get<Paginated<UserPublic>>('/auth/admin/users', { page, limit })
}

export async function apiInviteUser(email: string, role: string, fullName?: string): Promise<void> {
  await api.post<Envelope<{ success: boolean }>>('/auth/invitations', { email, role, fullName })
}

export async function apiDeactivateUser(id: string): Promise<void> {
  await api.delete<Envelope<{ success: boolean }>>(`/auth/admin/users/${id}`)
}

export async function apiAdminResetPassword(id: string): Promise<void> {
  await api.post<Envelope<{ success: boolean }>>(`/auth/admin/users/${id}/reset-password`)
}

export async function apiListAuditLogs(page = 1, limit = 100): Promise<Paginated<AuditLog>> {
  return api.get<Paginated<AuditLog>>('/auth/admin/audit-logs', { page, limit })
}

export async function apiListRoles(): Promise<{ data: Array<{
  id: string
  roleKey: string
  displayName: string
  description?: string | null
  permissions: Permission[]
  isSystem: boolean
  createdAt: string
  updatedAt: string
}> }> {
  const res = await api.get<{ data: unknown[] }>('/auth/admin/roles')
  return { data: (res.data ?? []).map((row) => RoleDefinitionSchema.parse(row)) }
}

export async function apiCreateRole(payload: {
  roleKey: string
  displayName: string
  description?: string
  permissions: Permission[]
}): Promise<void> {
  const body = CreateRoleDefinitionSchema.parse(payload)
  await api.post<Envelope<unknown>>('/auth/admin/roles', body)
}

export async function apiUpdateRole(
  roleKey: string,
  payload: Partial<{
    displayName: string
    description: string
    permissions: Permission[]
  }>
): Promise<void> {
  const body = UpdateRoleDefinitionSchema.parse(payload)
  await api.put<Envelope<unknown>>(`/auth/admin/roles/${encodeURIComponent(roleKey)}`, body)
}

export async function apiDeleteRole(roleKey: string): Promise<void> {
  await api.delete<Envelope<{ success: boolean }>>(`/auth/admin/roles/${encodeURIComponent(roleKey)}`)
}

export async function apiAssignUserRole(userId: string, role: string): Promise<void> {
  await api.patch<Envelope<{ success: boolean }>>(`/auth/admin/users/${userId}/role`, { role })
}

export async function apiGetAppSettings(): Promise<AppSettings> {
  const res = await api.get<Envelope<unknown>>('/auth/admin/app-settings')
  return AppSettingsSchema.parse(res.data)
}

export async function apiUpdateAppSettings(payload: Partial<AppSettings>): Promise<AppSettings> {
  const res = await api.put<Envelope<unknown>>('/auth/admin/app-settings', payload)
  return AppSettingsSchema.parse(res.data)
}

/** Pobiera kopię bazy danych jako plik (backup). Zwraca nazwę pliku po pomyślnym zapisie. */
export async function apiDownloadDatabaseBackup(): Promise<string> {
  const res = await axiosInstance.get<Blob>('/auth/admin/backup', { responseType: 'blob' })
  const disposition = res.headers['content-disposition']
  const match = disposition?.match(/filename="?([^";\n]+)"?/)
  const filename = match?.[1]?.trim() ?? `lama-stage-pg-backup-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.dump`
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return filename
}
