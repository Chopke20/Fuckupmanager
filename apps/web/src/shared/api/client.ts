import axios from 'axios'
import { pushApiFailure } from '../../modules/spinacz/diagnostics'

/** Limit czasu żądań (np. SMTP na serwerze): bez tego UI zostaje na „Wysyłanie…”. */
const API_REQUEST_TIMEOUT_MS = 120_000

const axiosInstance = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: API_REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor do obsługi błędów
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      const cfg = error?.config
      const url = typeof cfg?.url === 'string' ? cfg.url : ''
      // Nie rejestruj własnych faili feedbacku (unikamy pętli snarku przy SMTP fail).
      if (!url.includes('/feedback/')) {
        const headers = error?.response?.headers ?? {}
        const requestId =
          (typeof headers['x-request-id'] === 'string' && headers['x-request-id']) ||
          (typeof error?.response?.data?.requestId === 'string' && error.response.data.requestId) ||
          null
        pushApiFailure({
          method: String(cfg?.method ?? 'GET').toUpperCase(),
          url: url || '(unknown)',
          status: typeof error?.response?.status === 'number' ? error.response.status : null,
          requestId,
          message: String(error?.response?.data?.message || error?.message || 'API error'),
        })
      }
    } catch {
      /* ignore */
    }
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>): Promise<T> =>
    axiosInstance.get<T>(url, { params }).then((res) => res.data),

  post: <T>(url: string, data?: unknown): Promise<T> =>
    axiosInstance.post<T>(url, data).then((res) => res.data),

  put: <T>(url: string, data?: unknown): Promise<T> =>
    axiosInstance.put<T>(url, data).then((res) => res.data),

  patch: <T>(url: string, data?: unknown): Promise<T> =>
    axiosInstance.patch<T>(url, data).then((res) => res.data),

  delete: <T>(url: string): Promise<T> =>
    axiosInstance.delete<T>(url).then((res) => res.data),
}

export default axiosInstance
