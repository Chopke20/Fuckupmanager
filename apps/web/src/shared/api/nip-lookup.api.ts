import type { NipCompanyLookupResultDto } from '@lama-stage/shared-types'
import { api } from './client'

export async function apiNipCompanyLookup(nip: string): Promise<NipCompanyLookupResultDto> {
  const body = await api.post<{ data: NipCompanyLookupResultDto }>('/integrations/nip-lookup/lookup', { nip })
  return body.data
}
