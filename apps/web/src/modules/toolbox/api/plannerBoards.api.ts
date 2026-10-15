import axios from 'axios'
import {
  serializePlannerBoard,
  type PlannerBoardPayload,
} from '../planner/plannerTypes'

const API_BASE = '/api/planner-boards'

function filenameFromContentDisposition(header: unknown, fallback: string): string {
  if (typeof header !== 'string') return fallback
  const match = /filename="([^"]+)"/i.exec(header)
  return match?.[1] ?? fallback
}

export interface PlannerBoard {
  id: string
  name: string
  boardJson: string
  createdAt: string
  updatedAt: string
}

type Envelope<T> = { data: T }

export async function listPlannerBoards(search?: string): Promise<PlannerBoard[]> {
  const res = await axios.get<Envelope<PlannerBoard[]>>(API_BASE, {
    params: search ? { search } : undefined,
    withCredentials: true,
  })
  return res.data.data
}

export async function getPlannerBoard(id: string): Promise<PlannerBoard> {
  const res = await axios.get<Envelope<PlannerBoard>>(`${API_BASE}/${id}`, {
    withCredentials: true,
  })
  return res.data.data
}

export async function createPlannerBoard(params: {
  name: string
  boardJson: string
}): Promise<PlannerBoard> {
  const res = await axios.post<Envelope<PlannerBoard>>(API_BASE, params, {
    withCredentials: true,
  })
  return res.data.data
}

export async function updatePlannerBoard(
  id: string,
  params: { name?: string; boardJson?: string }
): Promise<PlannerBoard> {
  const res = await axios.patch<Envelope<PlannerBoard>>(`${API_BASE}/${id}`, params, {
    withCredentials: true,
  })
  return res.data.data
}

export async function deletePlannerBoard(id: string): Promise<void> {
  await axios.delete(`${API_BASE}/${id}`, { withCredentials: true })
}

export function lastPlannerBoardStorageKey(companyCode: string): string {
  return `lama-planner-last-board-${companyCode}`
}

export async function downloadPlannerPdf(
  name: string,
  board: PlannerBoardPayload
): Promise<void> {
  const res = await axios.post(
    `${API_BASE}/preview-pdf`,
    { name, boardJson: serializePlannerBoard(board) },
    { responseType: 'blob', withCredentials: true }
  )
  const blob = res.data as Blob
  if (blob.type === 'application/json') {
    const text = await blob.text()
    let msg = 'Nie udało się wygenerować PDF planera.'
    try {
      const parsed = JSON.parse(text) as { error?: string }
      if (typeof parsed.error === 'string') msg = parsed.error
    } catch {
      //
    }
    throw new Error(msg)
  }
  const filename = filenameFromContentDisposition(
    res.headers['content-disposition'],
    `Planer-${name}.pdf`
  )
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
