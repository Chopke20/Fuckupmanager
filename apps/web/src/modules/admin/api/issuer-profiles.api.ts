import type {
  CreateIssuerProfileInput,
  IssuerProfilePublic,
  UpdateIssuerProfileInput,
} from '@lama-stage/shared-types'
import { api } from '../../../shared/api/client'

type Paginated<T> = { data: T[]; meta: { total: number; page: number; lastPage: number } }

export async function apiListIssuerProfiles(page = 1, limit = 100, search?: string): Promise<Paginated<IssuerProfilePublic>> {
  return api.get<Paginated<IssuerProfilePublic>>('/issuer-profiles', {
    page,
    limit,
    ...(search?.trim() ? { search: search.trim() } : {}),
  })
}

export async function apiGetDefaultIssuerProfile(): Promise<IssuerProfilePublic | null> {
  const res = await api.get<{ data: IssuerProfilePublic | null }>('/issuer-profiles/default')
  return res.data ?? null
}

export async function apiCreateIssuerProfile(body: CreateIssuerProfileInput): Promise<IssuerProfilePublic> {
  const res = await api.post<{ data: IssuerProfilePublic }>('/issuer-profiles', body)
  return res.data
}

export async function apiUpdateIssuerProfile(id: string, body: UpdateIssuerProfileInput): Promise<IssuerProfilePublic> {
  const res = await api.patch<{ data: IssuerProfilePublic }>(`/issuer-profiles/${id}`, body)
  return res.data
}

export async function apiSetDefaultIssuerProfile(id: string): Promise<IssuerProfilePublic> {
  const res = await api.post<{ data: IssuerProfilePublic }>(`/issuer-profiles/${id}/set-default`)
  return res.data
}

export async function apiDeleteIssuerProfile(id: string): Promise<void> {
  await api.delete<{ data: { success: boolean } }>(`/issuer-profiles/${id}`)
}
