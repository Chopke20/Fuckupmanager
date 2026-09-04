import { Lock } from 'lucide-react'

/** Mała czerwona kłódka przy polach/wierszach tylko do odczytu. */
export default function LockedFieldHint({
  title = 'Brak możliwości edycji tego elementu',
}: {
  title?: string
}) {
  return (
    <span title={title} className="inline-flex shrink-0" aria-label={title}>
      <Lock size={12} className="text-red-500" aria-hidden />
    </span>
  )
}
