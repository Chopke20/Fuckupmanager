import { useEffect } from 'react'
import { Trash2, Eye, EyeOff, Plus } from 'lucide-react'
import {
  OrderProductionItem,
  OrderStage,
  ORDER_LINE_DESCRIPTION_MAX_LENGTH,
  clampOrderLineDescription,
} from '@lama-stage/shared-types'
import { useEquipment } from '../../equipment/hooks/useEquipment'
import { randomClientUuid } from '../../../shared/utils/uuid'
import { stageToDisplayLabel } from '../utils/stageLabel'
import {
  orderLineDescriptionInputClass,
  orderLineNameInputClass,
  orderLineNamePlaceholder,
} from '../utils/orderLineItemFieldStyles'
function stageDisplayName(stage: Partial<OrderStage>) {
  return stageToDisplayLabel(stage)
}

interface OrderProductionSectionProps {
  items: Partial<OrderProductionItem>[]
  stages: Partial<OrderStage>[]
  onChange: (items: Partial<OrderProductionItem>[]) => void
  lockedOfferBlockId?: string
  hideSectionTitle?: boolean
  compactLayout?: boolean
}

const PRODUCTION_COL_COUNT = 10

const VISIBILITY_TOOLTIP =
  'Widoczna w ofercie — pozycja trafi do PDF. Ukryta — tylko w zleceniu, bez PDF dla klienta.'

export default function OrderProductionSection({
  items = [],
  stages = [],
  onChange,
  lockedOfferBlockId,
  hideSectionTitle = false,
  compactLayout = false,
}: OrderProductionSectionProps) {
  const { data: paginatedResources } = useEquipment({ category: 'ZASOBY', limit: 200, page: 1 })
  const resources = paginatedResources?.data || []
  const findResourceByName = (name: string) => {
    const normalized = name.trim().toLowerCase()
    if (!normalized) return undefined
    return resources.find((r) => r.name.trim().toLowerCase() === normalized)
  }

  useEffect(() => {
    if (!resources.length || !items.length) return
    let hasChanges = false
    const nextItems = items.map((item) => {
      if (item.isTransport) return item
      const currentRate = typeof item.rateValue === 'number' ? item.rateValue : Number(item.rateValue)
      if (Number.isFinite(currentRate) && currentRate > 0) return item
      const matched = findResourceByName(item.name || '')
      if (!matched) return item
      hasChanges = true
      return {
        ...item,
        name: matched.name,
        rateValue: Number(matched.dailyPrice) || 0,
        description: item.description || matched.description || '',
      }
    })
    if (hasChanges) onChange(nextItems)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources])
  const addEmptyRows = (count: number) => {
    const safeCount = Math.max(1, Math.floor(count))
    const baseSort = items.length
    const newItems: Partial<OrderProductionItem>[] = Array.from({ length: safeCount }, (_, idx) => ({
      id: randomClientUuid(),
      orderId: '',
      name: '',
      description: '',
      rateType: 'FLAT',
      rateValue: 0,
      units: 1,
      discount: 0,
      stageIds: undefined,
      isTransport: false,
      isAutoCalculated: false,
      isSubcontractor: false,
      visibleInOffer: true,
      sortOrder: baseSort + idx,
      offerBlockId: lockedOfferBlockId ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    onChange([...items, ...newItems])
  }

  const updateItem = (index: number, updates: Partial<OrderProductionItem>) => {
    const updated = [...items]
    updated[index] = { ...updated[index], ...updates }
    onChange(updated)
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const calculateItemTotal = (item: Partial<OrderProductionItem>) => {
    const base = (item.rateValue || 0) * (item.units || 1)
    return base * (1 - (item.discount || 0) / 100)
  }

  const totalValue = items.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  const subcontractorTotal = items
    .filter((item) => item.isSubcontractor)
    .reduce((sum, item) => sum + calculateItemTotal(item), 0)

  const parseStageIds = (item: Partial<OrderProductionItem>): string[] => {
    if (!item.stageIds) return []
    try {
      const v = item.stageIds
      if (typeof v === 'string') return JSON.parse(v) as string[]
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  }

  const setItemStageIds = (index: number, stageIds: string[]) => {
    updateItem(index, { stageIds: JSON.stringify(stageIds) as any })
  }

  return (
    <div className="space-y-3">
      {!hideSectionTitle && (
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold">Produkcja i logistyka</h3>
          <span className="text-sm text-muted-foreground">{items.length} pozycji</span>
        </div>
      )}

      <datalist id="production-datalist">
        {resources.map((r) => (
          <option key={r.id} value={r.name} />
        ))}
      </datalist>
      <div className="border border-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${compactLayout ? 'min-w-[880px]' : 'table-fixed min-w-[1000px]'}`}>
            <thead>
              <tr className="bg-surface-2 border-b border-border">
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground w-10">#</th>
                <th className={`text-left py-1.5 px-2 font-medium text-muted-foreground ${compactLayout ? 'w-48 min-w-[12rem]' : 'w-[28rem] min-w-[22rem]'}`}>Nazwa</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground w-24">Stawka</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground w-16">Jedn.</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground w-16">Rabat</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground w-40">Etap</th>
                <th className="text-right py-1.5 px-2 font-medium text-muted-foreground w-28">Netto</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground w-16">Podw.</th>
                <th
                  className="text-left py-1.5 px-2 font-medium text-muted-foreground w-20"
                  title={VISIBILITY_TOOLTIP}
                >
                  Oferta
                </th>
                <th className="text-center py-1.5 px-2 font-medium text-muted-foreground w-20 sticky right-0 bg-surface-2 z-10">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const stageIds = parseStageIds(item)
                return (
                  <tr key={item.id || index} className="border-b border-border/50 hover:bg-surface-2/50">
                    <td className="py-1 px-2 text-muted-foreground whitespace-nowrap">{index + 1}</td>
                    <td className="py-1 px-2">
                      <input
                        type="text"
                        list="production-datalist"
                        className={orderLineNameInputClass}
                        value={item.name || ''}
                        onChange={(e) => updateItem(index, { name: e.target.value })}
                        onBlur={(e) => {
                          const matched = findResourceByName(e.target.value)
                          if (!matched) return
                          updateItem(index, {
                            name: matched.name,
                            rateValue: Number(matched.dailyPrice) || 0,
                            description: clampOrderLineDescription(
                              item.description || matched.description || ''
                            ),
                          })
                        }}
                        placeholder={orderLineNamePlaceholder}
                      />
                      <input
                        type="text"
                        maxLength={ORDER_LINE_DESCRIPTION_MAX_LENGTH}
                        className={orderLineDescriptionInputClass}
                        value={item.description || ''}
                        onChange={(e) =>
                          updateItem(index, { description: clampOrderLineDescription(e.target.value) })
                        }
                        placeholder={`Opis w ofercie (max ${ORDER_LINE_DESCRIPTION_MAX_LENGTH} znaków)`}
                      />
                    </td>
                    <td className="py-1 px-2 whitespace-nowrap">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="w-20 px-2 py-1 text-xs bg-background border border-border rounded text-right"
                        value={typeof item.rateValue === 'number' && Number.isFinite(item.rateValue) ? item.rateValue : (Number(item.rateValue) || 0)}
                        onChange={(e) => updateItem(index, { rateValue: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="py-1 px-2 whitespace-nowrap">
                      <input
                        type="number"
                        min={1}
                        className="w-14 px-2 py-1 text-xs bg-background border border-border rounded text-right"
                        value={item.units ?? 1}
                        onChange={(e) => updateItem(index, { units: parseFloat(e.target.value) || 1 })}
                      />
                    </td>
                    <td className="py-1 px-2 whitespace-nowrap">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="w-14 px-2 py-1 text-xs bg-background border border-border rounded text-right"
                        value={item.discount ?? 0}
                        onChange={(e) => updateItem(index, { discount: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="py-1 px-2">
                      <select
                        className="w-full min-w-[100px] px-2 py-1 text-xs bg-background border border-border rounded"
                        value={stageIds[0] ?? ''}
                        onChange={(e) => {
                          const id = e.target.value
                          setItemStageIds(index, id ? [id] : [])
                        }}
                      >
                        <option value="">—</option>
                        {stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.date ? new Date(s.date).toLocaleDateString('pl') : ''} {stageDisplayName(s)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 px-2 font-medium text-right text-xs whitespace-nowrap">
                      {calculateItemTotal(item).toFixed(2)} PLN
                    </td>
                    <td className="py-1 px-2 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={!!item.isSubcontractor}
                        onChange={(e) => updateItem(index, { isSubcontractor: e.target.checked })}
                        title="Podwykonawca"
                      />
                    </td>
                    <td className="py-1 px-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => updateItem(index, { visibleInOffer: !item.visibleInOffer })}
                        className={`p-1 rounded ${item.visibleInOffer !== false ? 'text-green-500' : 'text-muted-foreground'}`}
                        title={VISIBILITY_TOOLTIP}
                      >
                        {item.visibleInOffer !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </td>
                    <td className="py-1 px-2 whitespace-nowrap sticky right-0 bg-background z-[1] text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-1 text-red-500 hover:text-red-700"
                        title="Usuń"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2 border-t border-border">
                <td colSpan={PRODUCTION_COL_COUNT} className="py-1.5 px-2">
                  <button
                    type="button"
                    onClick={() => addEmptyRows(1)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Plus size={14} />
                    Dodaj wiersz
                  </button>
                  <button
                    type="button"
                    onClick={() => addEmptyRows(5)}
                    className="ml-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Plus size={14} />
                    Dodaj 5 wierszy
                  </button>
                </td>
              </tr>
              <tr className="bg-surface-2 border-t border-border">
                <td colSpan={6} className="py-1.5 px-2 text-right font-medium text-sm">
                  Suma netto:
                </td>
                <td className="py-1.5 px-2 font-bold text-right text-sm min-w-[120px] whitespace-nowrap">
                  {totalValue.toFixed(2)} PLN
                </td>
                <td colSpan={3} className="py-1.5 px-2 text-sm text-right min-w-[160px] whitespace-nowrap">
                  <span className="text-amber-500 font-semibold">
                    Podwykonawcy: {subcontractorTotal.toFixed(2)} PLN
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
