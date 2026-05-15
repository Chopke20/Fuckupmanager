import { useCallback } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import {
  ORDER_OFFER_BLOCK_TITLE_MAX_LENGTH,
  clampOrderOfferBlockTitle,
  type OrderOfferBlock,
} from '@lama-stage/shared-types'
import { randomClientUuid } from '../../../shared/utils/uuid'

type Props = {
  blocks: Partial<OrderOfferBlock>[]
  onChange: (blocks: Partial<OrderOfferBlock>[]) => void
}

export default function OrderOfferBlocksSection({ blocks = [], onChange }: Props) {
  const addBlock = useCallback(() => {
    const next: Partial<OrderOfferBlock> = {
      id: randomClientUuid(),
      title: '',
      sortOrder: blocks.length,
    }
    onChange([...blocks, next])
  }, [blocks, onChange])

  const updateBlock = useCallback(
    (index: number, patch: Partial<OrderOfferBlock>) => {
      const next = [...blocks]
      next[index] = { ...next[index], ...patch }
      onChange(next)
    },
    [blocks, onChange],
  )

  const removeBlock = useCallback(
    (index: number) => {
      onChange(blocks.filter((_, i) => i !== index).map((b, i) => ({ ...b, sortOrder: i })))
    },
    [blocks, onChange],
  )

  const moveBlock = useCallback(
    (index: number, dir: -1 | 1) => {
      const target = index + dir
      if (target < 0 || target >= blocks.length) return
      const next = [...blocks]
      const tmp = next[index]
      next[index] = next[target]!
      next[target] = tmp!
      onChange(next.map((b, i) => ({ ...b, sortOrder: i })))
    },
    [blocks, onChange],
  )

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Bloki oferty</h3>
          <p className="text-xs text-gray-500">
            Opcjonalnie grupuj sprzęt, produkcję i transport w PDF. Tytuł bloku pojawi się w ofercie bez słowa „blok”.
          </p>
        </div>
        <button
          type="button"
          onClick={addBlock}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-100"
        >
          <Plus className="h-3.5 w-3.5" />
          Dodaj blok
        </button>
      </div>

      {blocks.length === 0 ? (
        <p className="text-xs text-gray-400 italic">
          Bez bloków oferta PDF wygląda jak dotychczas — trzy sekcje i jedno podsumowanie.
        </p>
      ) : (
        <ul className="space-y-2">
          {blocks.map((block, index) => (
            <li
              key={block.id ?? index}
              className="flex flex-wrap items-center gap-2 rounded-md border border-gray-100 bg-gray-50/80 px-3 py-2"
            >
              <span className="text-xs font-medium text-gray-500 w-6">{index + 1}.</span>
              <input
                type="text"
                maxLength={ORDER_OFFER_BLOCK_TITLE_MAX_LENGTH}
                placeholder="np. Duża scena"
                value={block.title ?? ''}
                onChange={(e) => updateBlock(index, { title: e.target.value })}
                onBlur={(e) => updateBlock(index, { title: clampOrderOfferBlockTitle(e.target.value) })}
                className="min-w-[12rem] flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Wyżej"
                  disabled={index === 0}
                  onClick={() => moveBlock(index, -1)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Niżej"
                  disabled={index === blocks.length - 1}
                  onClick={() => moveBlock(index, 1)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Usuń blok"
                  onClick={() => removeBlock(index)}
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
