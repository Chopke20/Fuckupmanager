import { useEffect, useState } from 'react'
import {
  emptyLedScreenProject,
  parseLedScreenProjectJson,
  type LedScreenProjectPayload,
} from '../../toolbox/calculators/ledScreen'
import LedScreensWorkspace from '../../toolbox/components/LedScreensWorkspace'
import {
  getLedScreenProjectByOrder,
  upsertLedScreenProjectForOrder,
} from '../../toolbox/api/ledScreenProjects.api'
import { useAuth } from '../../auth/AuthProvider'

export default function LedScreensOrderModal({
  open,
  orderId,
  offerBlockId,
  orderLabel,
  onClose,
}: {
  open: boolean
  orderId?: string | null
  offerBlockId?: string | null
  orderLabel?: string
  onClose: () => void
}) {
  const { user } = useAuth()
  const [payload, setPayload] = useState<LedScreenProjectPayload>(() => emptyLedScreenProject())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setPayload(emptyLedScreenProject())
    if (!orderId) return
    setLoading(true)
    void getLedScreenProjectByOrder(orderId, offerBlockId ?? null)
      .then((existing) => {
        if (cancelled || !existing) return
        const parsed = parseLedScreenProjectJson(existing.projectJson)
        if (parsed) setPayload(parsed)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Nie załadowano projektu LED.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, orderId, offerBlockId])

  if (!open) return null

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const name = orderLabel?.trim() || 'Ekrany LED'
      if (orderId) {
        await upsertLedScreenProjectForOrder(orderId, {
          name,
          project: payload,
          offerBlockId: offerBlockId ?? null,
        })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać projektu LED.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-border bg-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="led-screens-dialog-title"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 id="led-screens-dialog-title" className="text-lg font-bold">
              Ekrany LED
            </h2>
            {orderLabel ? (
              <p className="mt-0.5 text-xs text-muted-foreground">Zlecenie: {orderLabel}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded border-2 border-primary px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              {saving ? 'Zapis…' : orderId ? 'Zapisz do zlecenia' : 'Zastosuj'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Zamknij
            </button>
          </div>
        </div>
        {error ? (
          <p className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">{error}</p>
        ) : null}
        <div className="overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Ładowanie projektu LED…</p>
          ) : (
            <LedScreensWorkspace
              key={`${orderId ?? 'new'}-${offerBlockId ?? 'order'}`}
              project={payload}
              onChange={setPayload}
              projectName={orderLabel}
              logoUrl={user?.logoDarkBgUrl ?? user?.logoLightBgUrl ?? null}
              compactHeader
            />
          )}
        </div>
      </div>
    </div>
  )
}
