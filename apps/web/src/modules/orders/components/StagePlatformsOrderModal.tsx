import { useCallback, useState } from 'react'
import StagePlatformVisualizer from '../../toolbox/components/StagePlatformVisualizer'
import type { StagePlan } from '@lama-stage/shared-types'
import ConfirmationModal from '../../../shared/components/ConfirmationModal'

export default function StagePlatformsOrderModal({
  open,
  orderId,
  offerBlockId,
  sceneId,
  orderLabel,
  initialPlan,
  onClose,
  onApply,
}: {
  open: boolean
  orderId?: string | null
  offerBlockId?: string | null
  sceneId?: string | null
  orderLabel?: string
  initialPlan?: StagePlan | null
  onClose: () => void
  onApply: (plan: StagePlan) => void | Promise<void>
}) {
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  const requestClose = useCallback(() => {
    if (dirty) {
      setConfirmClose(true)
      return
    }
    onClose()
  }, [dirty, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-border bg-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stage-platforms-dialog-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="stage-platforms-dialog-title" className="text-lg font-bold">
              Scena z podestów
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {orderLabel ? <span>{orderLabel}</span> : null}
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
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="min-h-[min(78vh,820px)]">
            <StagePlatformVisualizer
              key={`${orderId ?? 'new-order'}-${offerBlockId ?? 'order'}-${sceneId ?? 'scene'}`}
              initialPlan={initialPlan}
              onDirtyChange={setDirty}
              onApply={(plan) => {
                void Promise.resolve(onApply(plan)).then(() => {
                  setDirty(false)
                  onClose()
                })
              }}
            />
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmClose}
        title="Niezapisane zmiany"
        message="Zamknąć okno bez dodania planu do zlecenia? Zmiany w rzucie zostaną utracone, jeśli nie zapiszesz zlecenia."
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
