import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { applyCompanyTheme, resetCompanyTheme } from '../../../lib/companyTheme'
import ProposalClientView from '../components/ProposalClientView'
import '../components/proposalPublic.css'
import type { ProposalPublicSnapshot } from '../utils/proposalPublic'

type PublicPayload = {
  status: 'ACTIVE' | 'EXPIRED'
  documentNumber: string
  expiresAt: string
  signals: { interestedOptionIds: string[]; discussRequestedAt: string | null }
  snapshot: ProposalPublicSnapshot
}

export default function PublicProposalPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    axios
      .get<{ data: PublicPayload }>(`/api/public/proposals/${token}`)
      .then((res) => {
        if (cancelled) return
        setData(res.data.data)
        applyCompanyTheme(res.data.data.snapshot.branding.primaryColorHex)
      })
      .catch(() => {
        if (!cancelled) setError('Nie znaleziono tej oferty albo link jest nieprawidłowy.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      resetCompanyTheme()
    }
  }, [token])

  const saveSignals = useCallback(
    async (body: { interestedOptionIds?: string[]; discussRequested?: boolean }) => {
      if (!token) return
      const res = await axios.post<{ data: PublicPayload['signals'] }>(`/api/public/proposals/${token}/signals`, body)
      setData((prev) => (prev ? { ...prev, signals: res.data.data } : prev))
    },
    [token]
  )

  const toggleOption = async (optionId: string) => {
    if (!data) return
    const current = data.signals.interestedOptionIds
    const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]
    setData({ ...data, signals: { ...data.signals, interestedOptionIds: next } })
    try {
      await saveSignals({ interestedOptionIds: next })
    } catch {
      setData(data)
    }
  }

  const discuss = async () => {
    try {
      await saveSignals({ discussRequested: true })
    } catch {
      setError('Nie udało się zapisać sygnału.')
    }
  }

  const downloadPdf = async () => {
    if (!token) return
    setPdfBusy(true)
    try {
      const res = await axios.get(`/api/public/proposals/${token}/pdf`, { responseType: 'blob' })
      const blob = res.data as Blob
      if (blob.type === 'application/json') {
        throw new Error('PDF niedostępny')
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Oferta-${data?.snapshot.offer.documentNumber ?? 'proposal'}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('Nie udało się pobrać PDF.')
    } finally {
      setPdfBusy(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Ładowanie oferty…</div>
  }
  if (error || !data) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">{error ?? 'Brak oferty.'}</div>
  }

  const expired = data.status === 'EXPIRED'
  const skin = data.snapshot.skin === 'DYNAMIC' ? 'proposal-skin-dynamic' : 'proposal-skin-minimal'

  return (
    <div className={`proposal-public-root ${skin}`}>
      <ProposalClientView
        snapshot={data.snapshot}
        expired={expired}
        interestedOptionIds={data.signals.interestedOptionIds}
        discussRequested={Boolean(data.signals.discussRequestedAt)}
        onToggleOption={expired ? undefined : toggleOption}
        onDiscuss={expired ? undefined : discuss}
        onDownloadPdf={expired ? undefined : downloadPdf}
        pdfBusy={pdfBusy}
      />
    </div>
  )
}
