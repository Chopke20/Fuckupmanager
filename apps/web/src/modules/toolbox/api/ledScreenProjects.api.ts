import axios from 'axios'
import {
  serializeLedScreenProject,
  type LedScreenProjectPayload,
} from '../calculators/ledScreen'

const API_BASE = '/api/led-screen-projects'

export interface LedScreenProjectOrderRef {
  id: string
  name: string
  orderYear: number | null
  orderNumber: number | null
}

export interface LedScreenProject {
  id: string
  name: string
  projectJson: string
  orderId: string | null
  offerBlockId: string | null
  createdAt: string
  updatedAt: string
  order: LedScreenProjectOrderRef | null
}

type Envelope<T> = { data: T }

export async function listLedScreenProjects(search?: string): Promise<LedScreenProject[]> {
  const res = await axios.get<Envelope<LedScreenProject[]>>(API_BASE, {
    params: search ? { search } : undefined,
    withCredentials: true,
  })
  return res.data.data
}

export async function getLedScreenProject(id: string): Promise<LedScreenProject> {
  const res = await axios.get<Envelope<LedScreenProject>>(`${API_BASE}/${id}`, {
    withCredentials: true,
  })
  return res.data.data
}

export async function createLedScreenProject(params: {
  name: string
  projectJson: string
  orderId?: string | null
}): Promise<LedScreenProject> {
  const res = await axios.post<Envelope<LedScreenProject>>(API_BASE, params, {
    withCredentials: true,
  })
  return res.data.data
}

export async function updateLedScreenProject(
  id: string,
  params: { name?: string; projectJson?: string; orderId?: string | null }
): Promise<LedScreenProject> {
  const res = await axios.patch<Envelope<LedScreenProject>>(`${API_BASE}/${id}`, params, {
    withCredentials: true,
  })
  return res.data.data
}

export async function deleteLedScreenProject(id: string): Promise<void> {
  await axios.delete(`${API_BASE}/${id}`, { withCredentials: true })
}

export async function getLedScreenProjectByOrder(
  orderId: string,
  offerBlockId?: string | null
): Promise<LedScreenProject | null> {
  try {
    const res = await axios.get<Envelope<LedScreenProject>>(`${API_BASE}/by-order/${orderId}`, {
      params: offerBlockId ? { offerBlockId } : undefined,
      withCredentials: true,
    })
    return res.data.data
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 404) return null
    throw e
  }
}

export async function upsertLedScreenProjectForOrder(
  orderId: string,
  params: {
    name: string
    project: LedScreenProjectPayload
    offerBlockId?: string | null
  }
): Promise<LedScreenProject> {
  const res = await axios.put<Envelope<LedScreenProject>>(
    `${API_BASE}/by-order/${orderId}`,
    {
      name: params.name,
      projectJson: serializeLedScreenProject(params.project),
      offerBlockId: params.offerBlockId ?? null,
    },
    { withCredentials: true }
  )
  return res.data.data
}

export function orderLedProjectLabel(project: LedScreenProject): string | null {
  if (!project.order) return null
  const num =
    project.order.orderYear != null && project.order.orderNumber != null
      ? `${project.order.orderYear}/${project.order.orderNumber}`
      : null
  return num ? `${num} · ${project.order.name}` : project.order.name
}

export function lastLedScreenProjectStorageKey(companyCode: string): string {
  return `lama-led-screen-last-project-${companyCode}`
}
