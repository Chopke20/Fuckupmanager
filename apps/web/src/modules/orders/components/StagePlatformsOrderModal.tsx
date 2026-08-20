import StagePlatformVisualizer from '../../toolbox/components/StagePlatformVisualizer'
import type { StagePlan } from '@lama-stage/shared-types'

export default function StagePlatformsOrderModal({
  open,
  initialPlan,
  onClose,
  onApply,
}: {
  open: boolean
  initialPlan?: StagePlan | null
  onClose: () => void
  onApply: (plan: StagePlan) => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stage-platforms-dialog-title"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="stage-platforms-dialog-title" className="text-lg font-bold">
            Scena z podestów
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Zamknij
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <StagePlatformVisualizer
            initialPlan={initialPlan}
            applyLabel="Dodaj podesty i obicie do zlecenia"
            onApply={(plan) => {
              onApply(plan)
              onClose()
            }}
          />
        </div>
      </div>
    </div>
  )
}
