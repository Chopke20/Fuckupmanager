import {
  AppSettingsAdminSchema,
  AppSettingsPublicSchema,
  UpdateAppSettingsSchema,
  type AppSettingsAdmin,
  type AppSettingsPublic,
  type UpdateAppSettingsInput,
} from '@lama-stage/shared-types'
import { api } from '../../shared/api/client'

type Envelope<T> = { data: T }

export async function apiGetPublicAppSettings(): Promise<AppSettingsPublic> {
  const res = await api.get<Envelope<unknown>>('/app-settings/public')
  return AppSettingsPublicSchema.parse(res.data)
}

export async function apiGetAdminAppSettings(): Promise<AppSettingsAdmin> {
  const res = await api.get<Envelope<unknown>>('/app-settings/admin')
  return AppSettingsAdminSchema.parse(res.data)
}

export async function apiUpdateAppSettings(payload: UpdateAppSettingsInput): Promise<AppSettingsAdmin> {
  const body = UpdateAppSettingsSchema.parse(payload)
  const res = await api.put<Envelope<unknown>>('/app-settings/admin', body)
  return AppSettingsAdminSchema.parse(res.data)
}
