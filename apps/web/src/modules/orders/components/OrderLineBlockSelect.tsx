import { clampOrderOfferBlockTitle } from '@lama-stage/shared-types'

export type OfferBlockOption = { id: string; title: string }

type Props = {
  blocks: OfferBlockOption[]
  value?: string | null
  onChange: (offerBlockId: string | null) => void
  className?: string
}

/** Select „Blok” przy pozycji — ukryty, gdy brak zdefiniowanych bloków. */
export default function OrderLineBlockSelect({ blocks, value, onChange, className = '' }: Props) {
  if (!blocks.length) return null

  return (
    <select
      className={`rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 ${className}`}
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value
        onChange(v === '' ? null : v)
      }}
      title="Przypisz pozycję do bloku w ofercie PDF"
    >
      <option value="">Bez bloku</option>
      {blocks.map((b) => (
        <option key={b.id} value={b.id}>
          {clampOrderOfferBlockTitle(b.title) || '—'}
        </option>
      ))}
    </select>
  )
}
