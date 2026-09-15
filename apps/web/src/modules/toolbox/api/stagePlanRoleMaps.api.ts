import axios from 'axios'
import type { StagePlanRoleAction, StagePlanRoleMap, UpsertStagePlanRoleMapDto } from '@lama-stage/shared-types'

const API_BASE = '/api/stage-plan-role-maps'

type Envelope<T> = { data: T }

export async function listStagePlanRoleMaps(): Promise<StagePlanRoleMap[]> {
  const res = await axios.get<Envelope<StagePlanRoleMap[]>>(API_BASE, { withCredentials: true })
  return res.data.data
}

export async function upsertStagePlanRoleMap(
  payload: UpsertStagePlanRoleMapDto
): Promise<StagePlanRoleMap> {
  const res = await axios.put<Envelope<StagePlanRoleMap>>(API_BASE, payload, {
    withCredentials: true,
  })
  return res.data.data
}

export async function bulkUpsertStagePlanRoleMaps(
  maps: UpsertStagePlanRoleMapDto[]
): Promise<StagePlanRoleMap[]> {
  const res = await axios.put<Envelope<StagePlanRoleMap[]>>(
    `${API_BASE}/bulk`,
    { maps },
    { withCredentials: true }
  )
  return res.data.data
}

export async function deleteStagePlanRoleMap(roleKey: string): Promise<void> {
  await axios.delete(`${API_BASE}/${encodeURIComponent(roleKey)}`, { withCredentials: true })
}

export type { StagePlanRoleAction, StagePlanRoleMap, UpsertStagePlanRoleMapDto }
