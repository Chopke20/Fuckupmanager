import axios from 'axios'
import type { SharedOfferPartnerLine, SharedOfferPublicView } from '@lama-stage/shared-types'
import { api } from '../../../shared/api/client'

function filenameFromContentDisposition(cd: string | undefined, fallback: string): string {
  if (!cd) return fallback
  const utf = /filename\*=UTF-8''([^;\n]+)/i.exec(cd)
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1].trim())
    } catch {
      return fallback
    }
  }
  const q = /filename="([^"]+)"/i.exec(cd)
  if (q?.[1]) return q[1]
  const u = /filename=([^;\n]+)/i.exec(cd)
  if (u?.[1]) return u[1].trim().replace(/^"|"$/g, '')
  return fallback
}

export type SharedOfferStatusResponse = {
  hasSession: boolean
  session: {
    id: string
    publicToken: string
    revokedAt: string | null
    lastSavedAt: string | null
    createdAt: string
    updatedAt: string
  } | null
  partnerLineCount: number
  partnerNet: number
  events: Array<{ id: string; eventType: string; createdAt: string }>
}

export class SharedOfferLockedChangedError extends Error {
  readonly code = 'LOCKED_CHANGED' as const
  constructor(public view: SharedOfferPublicView) {
    super('Pozycje Lama Stage zmieniły się od otwarcia edytora.')
    this.name = 'SharedOfferLockedChangedError'
  }
}

async function parseLockedChanged(error: unknown): Promise<SharedOfferPublicView | null> {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null
  const data = error.response.data as {
    error?: { code?: string; details?: { view?: SharedOfferPublicView } }
    code?: string
    details?: { view?: SharedOfferPublicView }
  }
  const code = data?.error?.code ?? data?.code
  const view = data?.error?.details?.view ?? data?.details?.view
  if (code === 'LOCKED_CHANGED' && view) return view
  return null
}

export const sharedOfferPublicApi = {
  get: async (token: string): Promise<SharedOfferPublicView> => {
    const res = await axios.get<{ data: SharedOfferPublicView }>(`/api/public/shared-offer/${token}`)
    return res.data.data
  },

  save: async (
    token: string,
    lines: SharedOfferPartnerLine[],
    lockedFingerprint?: string
  ): Promise<SharedOfferPublicView> => {
    try {
      const res = await axios.put<{ data: SharedOfferPublicView }>(`/api/public/shared-offer/${token}`, {
        lines,
        lockedFingerprint,
      })
      return res.data.data
    } catch (error) {
      const view = await parseLockedChanged(error)
      if (view) throw new SharedOfferLockedChangedError(view)
      throw error
    }
  },

  generatePdf: async (token: string, lockedFingerprint?: string): Promise<void> => {
    try {
      const res = await axios.post(`/api/public/shared-offer/${token}/pdf`, { lockedFingerprint }, {
        responseType: 'blob',
      })
      const blob = res.data as Blob
      if (blob.type === 'application/json') {
        const text = await blob.text()
        let msg = 'Nie udało się wygenerować PDF.'
        try {
          const j = JSON.parse(text) as { error?: string | { message?: string; code?: string; details?: { view?: SharedOfferPublicView } } }
          if (typeof j.error === 'string') msg = j.error
          else if (j.error && typeof j.error === 'object') {
            if (j.error.code === 'LOCKED_CHANGED' && j.error.details?.view) {
              throw new SharedOfferLockedChangedError(j.error.details.view)
            }
            if (typeof j.error.message === 'string') msg = j.error.message
          }
        } catch (inner) {
          if (inner instanceof SharedOfferLockedChangedError) throw inner
        }
        throw new Error(msg)
      }
      const name = filenameFromContentDisposition(res.headers['content-disposition'], 'Oferta-TOI.pdf')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      const view = await parseLockedChanged(error)
      if (view) throw new SharedOfferLockedChangedError(view)
      throw error
    }
  },
}

export const sharedOfferAdminApi = {
  status: async (orderId: string): Promise<SharedOfferStatusResponse> => {
    const res = await api.get<{ data: SharedOfferStatusResponse }>(`/orders/${orderId}/shared-offer`)
    return res.data
  },

  createLink: async (orderId: string): Promise<{ token: string; url: null; revokedAt: string | null }> => {
    const res = await api.post<{ data: { token: string; url: null; revokedAt: string | null } }>(
      `/orders/${orderId}/shared-offer/link`
    )
    return res.data
  },

  revokeLink: async (orderId: string): Promise<{ token: string; revokedAt: string | null }> => {
    const res = await api.delete<{ data: { token: string; revokedAt: string | null } }>(
      `/orders/${orderId}/shared-offer/link`
    )
    return res.data
  },
}
