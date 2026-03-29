import axios from 'axios'
import { Client, CreateClientDto, UpdateClientDto } from '@lama-stage/shared-types'

const API_BASE = '/api/clients'

export const clientApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; deletedOnly?: boolean }) =>
    axios.get<{ data: Client[]; meta: { total: number; page: number; lastPage: number } }>(API_BASE, { params }).then(res => res.data),
  getById: (id: string) =>
    axios.get<{ data: Client }>(`${API_BASE}/${id}`).then(res => res.data?.data ?? res.data),
  create: (data: CreateClientDto) =>
    axios.post<{ data: Client }>(API_BASE, data).then(res => res.data?.data ?? res.data),
  update: (id: string, data: UpdateClientDto) =>
    axios.put<{ data: Client }>(`${API_BASE}/${id}`, data).then(res => res.data?.data ?? res.data),
  delete: (id: string) => axios.delete(`${API_BASE}/${id}`).then(() => undefined),
  restore: (id: string) => axios.patch(`${API_BASE}/${id}/restore`).then(() => undefined),
  deletePermanent: (id: string) => axios.delete(`${API_BASE}/${id}/permanent`).then(() => undefined),
}