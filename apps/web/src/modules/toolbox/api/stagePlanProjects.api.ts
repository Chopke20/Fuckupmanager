import axios from 'axios'
import type { StagePlan } from '@lama-stage/shared-types'
import { serializeStagePlan } from '@lama-stage/shared-types'

const API_BASE = '/api/stage-plan-projects'

export interface StagePlanProjectOrderRef {
  id: string
  name: string
  orderYear: number | null
  orderNumber: number | null
}

export interface StagePlanProject {
  id: string
  name: string
  planJson: string
  orderId: string | null
  createdAt: string
  updatedAt: string
  order: StagePlanProjectOrderRef | null
}

type Envelope<T> = { data: T }

export async function listStagePlanProjects(search?: string): Promise<StagePlanProject[]> {
  const res = await axios.get<Envelope<StagePlanProject[]>>(API_BASE, {
    params: search ? { search } : undefined,
    withCredentials: true,
  })
  return res.data.data
}

export async function getStagePlanProject(id: string): Promise<StagePlanProject> {
  const res = await axios.get<Envelope<StagePlanProject>>(`${API_BASE}/${id}`, {
    withCredentials: true,
  })
  return res.data.data
}

export async function createStagePlanProject(params: {
  name: string
  planJson: string
  orderId?: string | null
}): Promise<StagePlanProject> {
  const res = await axios.post<Envelope<StagePlanProject>>(API_BASE, params, {
    withCredentials: true,
  })
  return res.data.data
}

export async function updateStagePlanProject(
  id: string,
  params: { name?: string; planJson?: string; orderId?: string | null }
): Promise<StagePlanProject> {
  const res = await axios.patch<Envelope<StagePlanProject>>(`${API_BASE}/${id}`, params, {
    withCredentials: true,
  })
  return res.data.data
}

export async function deleteStagePlanProject(id: string): Promise<void> {
  await axios.delete(`${API_BASE}/${id}`, { withCredentials: true })
}

export async function upsertStagePlanProjectForOrder(
  orderId: string,
  params: { name: string; plan: StagePlan }
): Promise<StagePlanProject> {
  const res = await axios.put<Envelope<StagePlanProject>>(
    `${API_BASE}/by-order/${orderId}`,
    { name: params.name, planJson: serializeStagePlan(params.plan) },
    { withCredentials: true }
  )
  return res.data.data
}

export function orderProjectLabel(project: StagePlanProject): string | null {
  if (!project.order) return null
  const num =
    project.order.orderYear != null && project.order.orderNumber != null
      ? `${project.order.orderYear}/${project.order.orderNumber}`
      : null
  return num ? `${num} · ${project.order.name}` : project.order.name
}

export function lastStagePlanProjectStorageKey(companyCode: string): string {
  return `lama-stage-plan-last-project-${companyCode}`
}
