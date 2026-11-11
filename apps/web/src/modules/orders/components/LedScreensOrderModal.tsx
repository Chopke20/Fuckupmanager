import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import {
  emptyLedScreenProject,
  type LedScreenProjectPayload,
} from '../../toolbox/calculators/ledScreen'
import LedScreensWorkspace from '../../toolbox/components/LedScreensWorkspace'
import LedScreenRoleMapModal from '../../toolbox/components/LedScreenRoleMapModal'
import { upsertLedScreenProjectForOrder } from '../../toolbox/api/ledScreenProjects.api'

export default function LedScreensOrderModal({
  open,
  orderId,
  offerBlockId,
  entryId,
  entryName,
  initialProject,
  orderLabel,
  onClose,
  onApply,
}: {
  open: boolean
  orderId?: string | null
  offerBlockId?: string | null
  entryId: string
  entryName: string
  initialProject?: LedScreenProjectPayload | null
  orderLabel?: string
  onClose: () => void
  onApply: (project: LedScreenProjectPayload) => void | Promise<void>
}) {
  const [payload, setPayload] = useState<LedScreenProjectPayload>(() => emptyLedScreenProject())
  const [name, setName] = useState(entryName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roleMapOpen, setRoleMapOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setName(entryName)
    setPayload(initialProject ?? emptyLedScreenProject())
  }, [open, entryId, entryName, initialProject])

  if (!open) return null

  const handleApply = async () => {
    setSaving(true)
    setError(null)
    try {
      await onApply(payload)
      if (orderId) {
        try {
          await upsertLedScreenProjectForOrder(orderId, {
            name: name.trim() || entryName || 'Ekrany LED',
            project: payload,
            offerBlockId: offerBlockId ?? null,
            screenSetId: entryId,
          })
        } catch {
          // Źródło prawdy to formularz zlecenia; projekt toolbox jest dodatkiem.
        }
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id="led-screens-dialog-title" className="text-lg font-bold">
              Ekrany LED
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <label className="text-[11px] text-muted-foreground">
                Nazwa projektu
                <input
                  className="ml-1.5 rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {orderLabel ? (
                <p className="text-xs text-muted-foreground">Zlecenie: {orderLabel}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Mapowanie ról LED → sprzęt"
              onClick={() => setRoleMapOpen(true)}
              className="rounded border border-border p-1.5 text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={saving}
              className="rounded border-2 border-primary px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              {saving ? 'Zapis…' : 'Dodaj do zlecenia'}
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
          <p className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
            {error}
          </p>
        ) : null}
        <div className="overflow-y-auto p-4">
          <LedScreensWorkspace
            project={payload}
            onChange={setPayload}
            projectName={name}
            compactHeader
          />
        </div>
      </div>

      <LedScreenRoleMapModal
        open={roleMapOpen}
        project={payload}
        onClose={() => setRoleMapOpen(false)}
      />
    </div>
  )
}
