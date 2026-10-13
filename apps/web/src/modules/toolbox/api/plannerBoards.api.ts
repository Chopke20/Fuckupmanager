import axios from 'axios'

const API_BASE = '/api/planner-boards'

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
