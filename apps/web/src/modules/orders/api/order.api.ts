import axios from 'axios';
import { Order, CreateOrderDto, UpdateOrderDto } from '@lama-stage/shared-types';

const API_BASE = '/api/orders';

export interface OrderDocumentExportMeta {
  id: string;
  orderId: string;
  documentType: string;
  documentNumber: string;
  exportedAt: string;
  createdAt: string;
}

export interface OrderDocumentDraftDto<T = Record<string, any>> {
  id: string | null;
  orderId: string;
  documentType: string;
  payload: T;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EquipmentAvailabilityItem {
  equipmentId: string;
  equipmentName: string;
  stockQuantity: number;
  requestedQuantity: number;
  isAvailable: boolean;
  summary: {
    maxReserved: number;
    minAvailable: number;
  };
  conflictingBlocks: {
    blockId: string;
    note: string | null;
    dateFrom: string;
    dateTo: string;
  }[];
  conflictingOrders: {
    orderId: string;
    orderName: string;
    dateFrom: string;
    dateTo: string;
  }[];
}

export const orderApi = {
  getAll: (params?: {
    status?: string;
    clientId?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    limit?: number;
    deletedOnly?: boolean;
    includeDeleted?: boolean;
  }) =>
    axios
      .get<{ data: Order[]; meta: { total: number; page: number; lastPage: number } }>(API_BASE, { params })
      .then(res => res.data),

  getById: (id: string) =>
    axios.get<{ data?: Order }>(`${API_BASE}/${id}`).then(res => res.data?.data ?? res.data),

  create: (data: CreateOrderDto) =>
    axios.post<{ data?: Order }>(API_BASE, data).then(res => res.data?.data ?? res.data),

  update: (id: string, data: UpdateOrderDto) => {
    const body = JSON.parse(JSON.stringify(data)) as UpdateOrderDto;
    return axios.put<{ data?: Order }>(`${API_BASE}/${id}`, body).then(res => res.data?.data ?? res.data);
  },

  delete: (id: string) => axios.delete(`${API_BASE}/${id}`).then(() => undefined),
  restore: (id: string) => axios.patch(`${API_BASE}/${id}/restore`).then(() => undefined),
  deletePermanent: (id: string) => axios.delete(`${API_BASE}/${id}/permanent`).then(() => undefined),

  checkEquipmentAvailability: (params: {
    equipmentIds: string[];
    dateFrom: string;
    dateTo: string;
    excludeOrderId?: string;
    requests?: Array<{ equipmentId: string; quantity: number }>;
  }) =>
    axios.post<{ success: boolean; data: EquipmentAvailabilityItem[] }>(
      `${API_BASE}/availability`,
      params
    ).then(res => res.data),

  getConflicts: (params?: { from?: string; to?: string }) =>
    axios.get<any[]>(`${API_BASE}/conflicts`, { params }).then(res => res.data),

  getDocumentExports: (orderId: string, documentType?: string) =>
    axios
      .get<{ data: OrderDocumentExportMeta[] }>(`${API_BASE}/${orderId}/documents/exports`, {
        params: documentType ? { documentType } : undefined,
      })
      .then(res => res.data.data),

  createDocumentExport: (orderId: string, documentType: string) =>
    axios
      .post<{ data: OrderDocumentExportMeta }>(`${API_BASE}/${orderId}/documents/exports`, { documentType })
      .then(res => res.data.data),

  getDocumentExport: (orderId: string, exportId: string) =>
    axios
      .get<{ data: any }>(`${API_BASE}/${orderId}/documents/exports/${exportId}`)
      .then(res => res.data.data),

  deleteDocumentExport: (orderId: string, exportId: string) =>
    axios
      .delete<{ data: { ok: true } }>(`${API_BASE}/${orderId}/documents/exports/${exportId}`)
      .then((res) => res.data.data),

  getDocumentDraft: <T = Record<string, any>>(orderId: string, documentType: string) =>
    axios
      .get<{ data: OrderDocumentDraftDto<T> }>(`${API_BASE}/${orderId}/documents/draft`, { params: { documentType } })
      .then(res => res.data.data),

  updateDocumentDraft: <T = Record<string, any>>(orderId: string, documentType: string, payload: T) =>
    axios
      .put<{ data: OrderDocumentDraftDto<T> }>(`${API_BASE}/${orderId}/documents/draft`, { documentType, payload })
      .then(res => res.data.data),

  rewriteDescription: (payload: {
    rawText: string;
    name?: string;
    venue?: string;
    status?: string;
    retry?: boolean;
  }) =>
    axios.post<{ description: string }>(`/api/ai/order-description`, payload).then(res => res.data),

  generateOfferClientDescription: (
    orderId: string,
    payload: {
      orderName: string;
      venue?: string;
      clientCompanyName?: string;
      startDate?: string;
      endDate?: string;
      internalDescription?: string;
      stagesSummary?: string;
      equipmentSummary?: string;
      currentClientDescription?: string;
      retry?: boolean;
    }
  ) =>
    axios
      .post<{ description: string }>(`${API_BASE}/${orderId}/documents/offer-client-description`, payload)
      .then((res) => res.data),
};
