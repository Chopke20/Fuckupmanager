import { useCallback } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import {
  ORDER_OFFER_BLOCK_TITLE_MAX_LENGTH,
  clampOrderOfferBlockTitle,
  type OrderEquipmentItem,
  type OrderOfferBlock,
  type OrderProductionItem,
  type OrderStage,
} from '@lama-stage/shared-types'
import { randomClientUuid } from '../../../shared/utils/uuid'
import OrderEquipmentSection from './OrderEquipmentSection'
import OrderProductionSection from './OrderProductionSection'
import {
  filterEquipmentByBlock,
  filterProductionByBlock,
  mergeEquipmentForBlock,
  mergeProductionForBlock,
} from '../utils/offerBlockItems'

type Props = {
  blocks: Partial<OrderOfferBlock>[]
  onBlocksChange: (blocks: Partial<OrderOfferBlock>[]) => void
  equipmentItems: Partial<OrderEquipmentItem>[]
  onEquipmentChange: (items: Partial<OrderEquipmentItem>[]) => void
  productionItems: Partial<OrderProductionItem>[]
  onProductionChange: (items: Partial<OrderProductionItem>[]) => void
  stages: Partial<OrderStage>[]
  excludeOrderId?: string
  orderDateFrom?: string
  orderDateTo?: string
  orderSpanDays?: number
}

export default function OrderOfferBlocksEditor({
  blocks,
  onBlocksChange,
  equipmentItems,
  onEquipmentChange,
  productionItems,
  onProductionChange,
  stages,
  excludeOrderId,
  orderDateFrom,
  orderDateTo,
  orderSpanDays = 1,
}: Props) {
  const addBlock = useCallback(() => {
    const next: Partial<OrderOfferBlock> = {
      id: randomClientUuid(),
      title: '',
      sortOrder: blocks.length,
    }
    onBlocksChange([...blocks, next])
  }, [blocks, onBlocksChange])

  const updateBlock = useCallback(
    (index: number, patch: Partial<OrderOfferBlock>) => {
      const next = [...blocks]
      next[index] = { ...next[index], ...patch }
      onBlocksChange(next)
    },
    [blocks, onBlocksChange],
  )

  const removeBlock = useCallback(
    (index: number) => {
      onBlocksChange(blocks.filter((_, i) => i !== index).map((b, i) => ({ ...b, sortOrder: i })))
    },
    [blocks, onBlocksChange],
  )

  const moveBlock = useCallback(
    (index: number, dir: -1 | 1) => {
      const target = index + dir
      if (target < 0 || target >= blocks.length) return
      const next = [...blocks]
      const tmp = next[index]
      next[index] = next[target]!
      next[target] = tmp!
      onBlocksChange(next.map((b, i) => ({ ...b, sortOrder: i })))
    },
    [blocks, onBlocksChange],
  )

  const unblockedEquipment = filterEquipmentByBlock(equipmentItems, null)
  const unblockedProduction = filterProductionByBlock(productionItems, null)
  const showUnblocked =
    unblockedEquipment.length > 0 || unblockedProduction.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Bloki oferty</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Każdy blok ma własny wykaz sprzętu i produkcji w ofercie PDF. Transport pozostaje osobno, jak harmonogram.
          </p>
        </div>
        <button
          type="button"
          onClick={addBlock}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface"
        >
          <Plus className="h-4 w-4" />
          Dodaj blok
        </button>
      </div>

      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Dodaj pierwszy blok, aby grupować pozycje w ofercie. Bez bloków układ PDF pozostaje jak dotychczas.
        </p>
      ) : (
        <div className="space-y-6">
          {blocks.map((block, index) => {
            const blockId = String(block.id)
            const blockEquipment = filterEquipmentByBlock(equipmentItems, blockId)
            const blockProduction = filterProductionByBlock(productionItems, blockId)

            return (
              <article
                key={blockId}
                className="rounded-xl border border-border bg-surface-2/80 p-4 space-y-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                  <span className="text-xs font-medium text-muted-foreground w-6">{index + 1}.</span>
                  <input
                    type="text"
                    maxLength={ORDER_OFFER_BLOCK_TITLE_MAX_LENGTH}
                    placeholder="np. Duża scena"
                    value={block.title ?? ''}
                    onChange={(e) => updateBlock(index, { title: e.target.value })}
                    onBlur={(e) => updateBlock(index, { title: clampOrderOfferBlockTitle(e.target.value) })}
                    className="min-w-[14rem] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Wyżej"
                      disabled={index === 0}
                      onClick={() => moveBlock(index, -1)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-surface disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Niżej"
                      disabled={index === blocks.length - 1}
                      onClick={() => moveBlock(index, 1)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-surface disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Usuń blok"
                      onClick={() => removeBlock(index)}
                      className="rounded p-1.5 text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <h4 className="text-sm font-semibold text-foreground">Wykaz sprzętu</h4>
                <OrderEquipmentSection
                  items={blockEquipment}
                  onChange={(items) => onEquipmentChange(mergeEquipmentForBlock(equipmentItems, blockId, items))}
                  lockedOfferBlockId={blockId}
                  hideSectionTitle
                  excludeOrderId={excludeOrderId}
                  orderDateFrom={orderDateFrom}
                  orderDateTo={orderDateTo}
                  orderSpanDays={orderSpanDays}
                />

                <h4 className="text-sm font-semibold text-foreground">Produkcja i logistyka</h4>
                <OrderProductionSection
                  items={blockProduction}
                  stages={stages}
                  onChange={(items) => onProductionChange(mergeProductionForBlock(productionItems, blockId, items))}
                  lockedOfferBlockId={blockId}
                  hideSectionTitle
                />
              </article>
            )
          })}
        </div>
      )}

      {blocks.length > 0 && showUnblocked && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-amber-200">Pozycje bez bloku</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Te pozycje nie są w żadnym bloku — przenieś je do bloku lub usuń, zanim wygenerujesz ofertę.
            </p>
          </div>
          {unblockedEquipment.length > 0 && (
            <OrderEquipmentSection
              items={unblockedEquipment}
              onChange={(items) => onEquipmentChange(mergeEquipmentForBlock(equipmentItems, null, items))}
              hideSectionTitle
              excludeOrderId={excludeOrderId}
              orderDateFrom={orderDateFrom}
              orderDateTo={orderDateTo}
              orderSpanDays={orderSpanDays}
            />
          )}
          {unblockedProduction.length > 0 && (
            <OrderProductionSection
              items={unblockedProduction}
              stages={stages}
              onChange={(items) => onProductionChange(mergeProductionForBlock(productionItems, null, items))}
              hideSectionTitle
            />
          )}
        </section>
      )}
    </div>
  )
}
