import { useCallback } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, LayoutGrid, Copy, Pencil } from 'lucide-react'
import {
  ORDER_OFFER_BLOCK_TITLE_MAX_LENGTH,
  clampOrderOfferBlockTitle,
  parseStagePlanSetJson,
  stagePlanSceneSummary,
  type OrderEquipmentItem,
  type OrderOfferBlock,
  type OrderProductionItem,
  type OrderStage,
} from '@lama-stage/shared-types'
import { randomClientUuid } from '../../../shared/utils/uuid'
import OrderEquipmentSection from './OrderEquipmentSection'
import OrderProductionSection from './OrderProductionSection'
import LockedFieldHint from './LockedFieldHint'
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
  onOpenStagePlan?: (offerBlockId: string, blockTitle: string, sceneId?: string) => void
  onAddStageScene?: (offerBlockId: string, blockTitle: string) => void
  onRemoveStageScene?: (offerBlockId: string, sceneId: string) => void
  onRenameStageScene?: (offerBlockId: string, sceneId: string, name: string) => void
  onOpenLedScreens?: (offerBlockId: string, blockTitle: string) => void
  readOnly?: boolean
  lockedItemIds?: ReadonlySet<string> | string[]
  partnerMode?: boolean
}

function cloneLineItemId(prefix: string): string {
  return `${prefix}-${randomClientUuid()}`
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
  onOpenStagePlan,
  onAddStageScene,
  onRemoveStageScene,
  onRenameStageScene,
  onOpenLedScreens,
  readOnly = false,
  lockedItemIds,
  partnerMode = false,
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

  const duplicateBlock = useCallback(
    (index: number) => {
      const source = blocks[index]
      if (!source?.id) return
      const sourceId = String(source.id)
      const newBlockId = randomClientUuid()
      const baseTitle = (source.title ?? '').trim()
      const copyTitle = clampOrderOfferBlockTitle(baseTitle ? `Kopia — ${baseTitle}` : 'Kopia bloku')

      const nextBlocks = [
        ...blocks.slice(0, index + 1),
        {
          ...source,
          id: newBlockId,
          title: copyTitle,
          sortOrder: index + 1,
          // stagePlanJson zostaje w kopii; projekty LED/sceny w DB nie są klonowane
        },
        ...blocks.slice(index + 1),
      ].map((b, i) => ({ ...b, sortOrder: i }))

      const clonedEquipment = filterEquipmentByBlock(equipmentItems, sourceId).map((row) => ({
        ...row,
        id: cloneLineItemId('temp'),
        offerBlockId: newBlockId,
      }))
      const clonedProduction = filterProductionByBlock(productionItems, sourceId).map((row) => ({
        ...row,
        id: cloneLineItemId('temp'),
        offerBlockId: newBlockId,
      }))

      onBlocksChange(nextBlocks)
      if (clonedEquipment.length) {
        onEquipmentChange([...equipmentItems, ...clonedEquipment])
      }
      if (clonedProduction.length) {
        onProductionChange([...productionItems, ...clonedProduction])
      }
    },
    [blocks, equipmentItems, onBlocksChange, onEquipmentChange, onProductionChange, productionItems],
  )

  const unblockedEquipment = filterEquipmentByBlock(equipmentItems, null)
  const unblockedProduction = filterProductionByBlock(productionItems, null)
  const showUnblocked = unblockedEquipment.length > 0 || unblockedProduction.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 py-2">
        <span className="text-sm font-semibold shrink-0">Bloki oferty</span>
        <span
          className="text-xs text-muted-foreground truncate flex-1 min-w-0"
          title="Każdy blok ma własny sprzęt i produkcję w PDF. Transport pozostaje osobno, jak harmonogram."
        >
          {blocks.length === 0
            ? 'Opcjonalnie'
            : `${blocks.length} ${blocks.length === 1 ? 'blok' : 'bloki'} · transport osobno`}
        </span>
        {!readOnly && (
          <button
            type="button"
            onClick={addBlock}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-surface"
          >
            <Plus className="h-3.5 w-3.5" />
            Dodaj blok
          </button>
        )}
      </div>

      {blocks.length > 0 && (
        <div className="space-y-4">
          {blocks.map((block, index) => {
            const blockId = String(block.id)
            const blockEquipment = filterEquipmentByBlock(equipmentItems, blockId)
            const blockProduction = filterProductionByBlock(productionItems, blockId)
            const titleLen = (block.title ?? '').length

            return (
              <article
                key={blockId}
                className="rounded-lg border border-border bg-surface-2/50 p-3 space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
                  <span className="text-xs font-medium text-muted-foreground w-5 shrink-0">{index + 1}.</span>
                  <div className="min-w-[10rem] flex-1 flex flex-col gap-0.5">
                    <input
                      type="text"
                      maxLength={ORDER_OFFER_BLOCK_TITLE_MAX_LENGTH}
                      placeholder="np. Duża scena"
                      value={block.title ?? ''}
                      disabled={readOnly}
                      onChange={(e) => updateBlock(index, { title: e.target.value })}
                      onBlur={(e) => updateBlock(index, { title: clampOrderOfferBlockTitle(e.target.value) })}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                    />
                    {!readOnly ? (
                      <span className="text-[10px] text-muted-foreground self-end">
                        {titleLen}/{ORDER_OFFER_BLOCK_TITLE_MAX_LENGTH}
                      </span>
                    ) : null}
                  </div>
                  {readOnly ? <LockedFieldHint /> : null}
                  {!readOnly && (
                    <div className="flex items-center gap-1 shrink-0">
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
                        title="Powiel blok"
                        onClick={() => duplicateBlock(index)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-surface"
                      >
                        <Copy className="h-4 w-4" />
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
                  )}
                </div>

                {(() => {
                  const blockTitle = block.title?.trim() || `Blok ${index + 1}`
                  const stageSet = parseStagePlanSetJson(
                    typeof block.stagePlanJson === 'string' ? block.stagePlanJson : null
                  )
                  return (
                    <div className="space-y-2">
                      <h4 className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>Sceny z podestów</span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {!readOnly && onAddStageScene ? (
                            <button
                              type="button"
                              onClick={() => onAddStageScene(blockId, blockTitle)}
                              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-normal normal-case tracking-normal hover:bg-surface"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Nowa scena
                            </button>
                          ) : null}
                          {!readOnly && onOpenStagePlan && stageSet.scenes.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => onOpenStagePlan(blockId, blockTitle)}
                              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-normal normal-case tracking-normal hover:bg-surface"
                            >
                              <LayoutGrid className="h-3.5 w-3.5" />
                              Złóż scenę
                            </button>
                          ) : null}
                          {!readOnly && onOpenLedScreens ? (
                            <button
                              type="button"
                              onClick={() => onOpenLedScreens(blockId, blockTitle)}
                              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-normal normal-case tracking-normal hover:bg-surface"
                            >
                              Ekrany LED
                            </button>
                          ) : null}
                        </span>
                      </h4>
                      {stageSet.scenes.length > 0 ? (
                        <ul className="space-y-1">
                          {stageSet.scenes.map((scene) => (
                            <li
                              key={scene.id}
                              className="flex flex-wrap items-center gap-2 rounded border border-border bg-background/60 px-2 py-1.5 text-xs"
                            >
                              <button
                                type="button"
                                className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
                                onClick={() => onOpenStagePlan?.(blockId, blockTitle, scene.id)}
                                title="Otwórz edytor sceny"
                              >
                                {stagePlanSceneSummary(scene)}
                              </button>
                              {!readOnly ? (
                                <span className="flex shrink-0 items-center gap-1">
                                  {onRenameStageScene ? (
                                    <button
                                      type="button"
                                      title="Zmień nazwę"
                                      className="rounded p-1 text-muted-foreground hover:bg-surface"
                                      onClick={() => {
                                        const next = window.prompt('Nazwa sceny', scene.name)
                                        if (next != null) onRenameStageScene(blockId, scene.id, next)
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                  ) : null}
                                  {onRemoveStageScene ? (
                                    <button
                                      type="button"
                                      title="Usuń scenę"
                                      className="rounded p-1 text-red-500 hover:bg-red-500/10"
                                      onClick={() => onRemoveStageScene(blockId, scene.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  ) : null}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-muted-foreground normal-case tracking-normal">
                          Brak scen w tym bloku — możesz dodać kilka niezależnych układów.
                        </p>
                      )}
                    </div>
                  )
                })()}

                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Wykaz sprzętu
                </h4>

                <OrderEquipmentSection
                  items={blockEquipment}
                  onChange={(items) => onEquipmentChange(mergeEquipmentForBlock(equipmentItems, blockId, items))}
                  lockedOfferBlockId={blockId}
                  hideSectionTitle
                  compactLayout
                  excludeOrderId={excludeOrderId}
                  orderDateFrom={orderDateFrom}
                  orderDateTo={orderDateTo}
                  orderSpanDays={orderSpanDays}
                  lockedItemIds={lockedItemIds}
                  partnerMode={partnerMode}
                />

                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Produkcja i logistyka
                </h4>

                <OrderProductionSection
                  items={blockProduction}
                  stages={stages}
                  onChange={(items) => onProductionChange(mergeProductionForBlock(productionItems, blockId, items))}
                  lockedOfferBlockId={blockId}
                  hideSectionTitle
                  compactLayout
                  lockedItemIds={lockedItemIds}
                  partnerMode={partnerMode}
                />
              </article>
            )
          })}
        </div>
      )}

      {blocks.length > 0 && showUnblocked && (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
          <p className="text-xs text-amber-200/90">
            Pozycje bez bloku — przenieś do bloku lub usuń przed generowaniem oferty.
          </p>
          {unblockedEquipment.length > 0 && (
            <OrderEquipmentSection
              items={unblockedEquipment}
              onChange={(items) => onEquipmentChange(mergeEquipmentForBlock(equipmentItems, null, items))}
              hideSectionTitle
              compactLayout
              excludeOrderId={excludeOrderId}
              orderDateFrom={orderDateFrom}
              orderDateTo={orderDateTo}
              orderSpanDays={orderSpanDays}
              lockedItemIds={lockedItemIds}
              partnerMode={partnerMode}
            />
          )}
          {unblockedProduction.length > 0 && (
            <OrderProductionSection
              items={unblockedProduction}
              stages={stages}
              onChange={(items) => onProductionChange(mergeProductionForBlock(productionItems, null, items))}
              hideSectionTitle
              compactLayout
              lockedItemIds={lockedItemIds}
              partnerMode={partnerMode}
            />
          )}
        </section>
      )}
    </div>
  )
}
