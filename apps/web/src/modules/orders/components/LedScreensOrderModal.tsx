import { useCallback, useEffect, useState } from 'react'
import {
  emptyLedScreenProject,
  type LedScreenProjectPayload,
} from '../../toolbox/calculators/ledScreen'
import LedScreensWorkspace from '../../toolbox/components/LedScreensWorkspace'
import { upsertLedScreenProjectForOrder } from '../../toolbox/api/ledScreenProjects.api'
import ConfirmationModal from '../../../shared/components/ConfirmationModal'

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
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setDirty(false)
    setName(entryName)
    setPayload(initialProject ?? emptyLedScreenProject())
  }, [open, entryId, entryName, initialProject])

  const requestClose = useCallback(() => {
    if (dirty) {
      setConfirmClose(true)
      return
    }
    onClose()
  }, [dirty, onClose])

  if (!open) return null

  const handleApply = async (project: LedScreenProjectPayload) => {
    setSaving(true)
    setError(null)
    try {
      await onApply(project)
      if (orderId) {
        try {
          await upsertLedScreenProjectForOrder(orderId, {
            name: name.trim() || entryName || 'Ekrany LED',
            project,
            offerBlockId: offerBlockId ?? null,
            screenSetId: entryId,
          })
        } catch {
          // Źródło prawdy to formularz zlecenia; projekt toolbox jest dodatkiem.
        }
      }
      setDirty(false)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać projektu LED.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div
        className="flex h-[min(90vh,880px)] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-border bg-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="led-screens-dialog-title"
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
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
                  onChange={(e) => {
                    setName(e.target.value)
                    setDirty(true)
                  }}
                />
              </label>
              {orderLabel ? (
                <p className="text-xs text-muted-foreground">{orderLabel}</p>
              ) : null}
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                  dirty
                    ? 'border-warning/50 bg-warning/10 text-warning'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {dirty ? 'Niezapisane zmiany' : 'Zapisano'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Zamknij
          </button>
        </div>
        {error ? (
          <p className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
            {error}
          </p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
          <LedScreensWorkspace
            project={payload}
            onChange={(next) => {
              setPayload(next)
              setDirty(true)
            }}
            projectName={name}
            fillHeight
            applyBusy={saving}
            onDirtyChange={setDirty}
            onApply={(project) => void handleApply(project)}
          />
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmClose}
        title="Niezapisane zmiany"
        message="Zamknąć okno bez dodania LED do zlecenia? Zmiany w projekcie zostaną utracone, jeśli nie zapiszesz zlecenia."
        confirmLabel="Zamknij bez zapisu"
        cancelLabel="Wróć"
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false)
          onClose()
        }}
      />
    </div>
  )
}
