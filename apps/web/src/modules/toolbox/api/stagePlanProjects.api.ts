import axios from 'axios'
import type { StagePlan } from '@lama-stage/shared-types'
import { serializeStagePlan } from '@lama-stage/shared-types'

const API_BASE = '/api/stage-plan-projects'

function filenameFromContentDisposition(header: unknown, fallback: string): string {
  if (typeof header !== 'string') return fallback
  const match = /filename="([^"]+)"/i.exec(header)
  return match?.[1] ?? fallback
}

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
  offerBlockId: string | null
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
  params: { name: string; plan: StagePlan; offerBlockId?: string | null }
): Promise<StagePlanProject> {
  const res = await axios.put<Envelope<StagePlanProject>>(
    `${API_BASE}/by-order/${orderId}`,
    {
      name: params.name,
      planJson: serializeStagePlan(params.plan),
      offerBlockId: params.offerBlockId ?? null,
    },
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

export async function downloadStagePlanPreviewPdf(
  plan: StagePlan,
  title: string
): Promise<void> {
  const res = await axios.post(
    `${API_BASE}/preview-pdf`,
    { planJson: serializeStagePlan(plan), title },
    { responseType: 'blob', withCredentials: true }
  )
  const blob = res.data as Blob
  if (blob.type === 'application/json') {
    const text = await blob.text()
    let msg = 'Nie udało się wygenerować PDF planu sceny.'
    try {
      const parsed = JSON.parse(text) as { error?: string }
      if (typeof parsed.error === 'string') msg = parsed.error
    } catch {
      //
    }
    throw new Error(msg)
  }
  const name = filenameFromContentDisposition(
    res.headers['content-disposition'],
    `Plan-sceny-${title}.pdf`
  )
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
