import axios from 'axios'
import { CreateEquipmentDto, UpdateEquipmentDto, Equipment, PaginatedEquipmentResponse } from '@lama-stage/shared-types'

const API_BASE = '/api/equipment'

export const equipmentApi = {
  getAll: (params?: { category?: string, subcategory?: string, search?: string, page?: number, limit?: number, deletedOnly?: boolean }) => {
    return axios.get<PaginatedEquipmentResponse>(API_BASE, { params }).then(res => res.data)
  },

  getById: (id: string) => {
    return axios.get<Equipment>(`${API_BASE}/${id}`).then(res => res.data)
  },

  create: (data: CreateEquipmentDto) => {
    return axios.post<Equipment>(API_BASE, data).then(res => res.data)
  },

  update: (id: string, data: UpdateEquipmentDto) => {
    return axios.put<Equipment>(`${API_BASE}/${id}`, data).then(res => res.data)
  },

  delete: (id: string) => {
    return axios.delete(`${API_BASE}/${id}`).then(res => res.data)
  },
  restore: (id: string) => {
    return axios.patch(`${API_BASE}/${id}/restore`).then(res => res.data)
  },
  deletePermanent: (id: string) => {
    return axios.delete(`${API_BASE}/${id}/permanent`).then(() => undefined)
  },

  getCategories: () => {
    return axios.get<string[]>(`${API_BASE}/categories`).then(res => res.data)
  },

  getResourceSubcategories: () => {
    return axios.get<string[]>(`${API_BASE}/resource-subcategories`).then(res => res.data)
  },

  clearResourceSubcategory: (name: string) => {
    return axios.patch<{ updated: number }>(`${API_BASE}/resource-subcategories/${encodeURIComponent(name)}/clear`).then(res => res.data)
  },

  renameResourceSubcategory: (oldName: string, newName: string) => {
    return axios.patch<{ updated: number }>(`${API_BASE}/resource-subcategories/${encodeURIComponent(oldName)}/rename`, { newName }).then(res => res.data)
  },

  generateDescription: (payload: { name: string; category?: string; subcategory?: string; currentDescription?: string; retry?: boolean }) => {
    return axios.post<{ description: string }>('/api/ai/description', payload).then(res => res.data)
  },

  getNextCode: (category: string) => {
    return axios.get<{ proposedCode: string }>(`${API_BASE}/next-code`, { params: { category } }).then(res => res.data)
  },

  getAvailability: (equipmentId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return axios.get<{
      equipmentId: string
      date: string
      stockQuantity: number
      reservedQuantity: number
      available: number
    }>(`${API_BASE}/availability?equipmentId=${equipmentId}&date=${dateStr}`).then(res => res.data)
  },
}
