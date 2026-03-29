interface ConfirmationModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Potwierdź',
  cancelLabel = 'Anuluj',
  onConfirm,
  onClose,
}: ConfirmationModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm border border-border rounded hover:bg-surface">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className="px-3 py-2 text-sm bg-destructive text-white rounded hover:opacity-90">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
