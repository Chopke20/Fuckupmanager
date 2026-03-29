import axios from 'axios'

const axiosInstance = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor do obsługi błędów
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
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
