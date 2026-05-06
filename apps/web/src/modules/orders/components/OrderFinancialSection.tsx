import { useMemo, useState } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'
import { Order, OrderEquipmentItem, OrderProductionItem, OrderStage } from '@lama-stage/shared-types'
import {
  calculateOrderFinancialSummary,
  computeEquipmentLineNet,
  computeProductionLineNet,
  computeRentalMarginDeduction,
  computeSubcontractorMarginDeduction,
} from '../utils/orderFinancialSummary'

interface OrderFinancialSectionProps {
  order: Partial<Order>
  equipmentItems: Partial<OrderEquipmentItem>[]
  productionItems: Partial<OrderProductionItem>[]
  stages?: Partial<OrderStage>[]
  onChange: (updates: Partial<Order>) => void
  onEquipmentMarginPatch: (index: number, patch: Partial<OrderEquipmentItem>) => void
  onProductionMarginPatch: (index: number, patch: Partial<OrderProductionItem>) => void
}

export default function OrderFinancialSection({
  order,
  equipmentItems = [],
  productionItems = [],
  stages = [],
  onChange,
  onEquipmentMarginPatch,
  onProductionMarginPatch,
}: OrderFinancialSectionProps) {
  const summary = calculateOrderFinancialSummary(order, equipmentItems, productionItems)
  const [marginModalOpen, setMarginModalOpen] = useState(false)

  const handleChange = (field: keyof Order, value: any) => {
    onChange({ [field]: value })
  }

  const marginRows = useMemo(() => {
    const rental = equipmentItems
      .map((item, index) => ({ kind: 'equipment' as const, item, index }))
      .filter(({ item }) => item.isRental)
    const sub = productionItems
      .map((item, index) => ({ kind: 'production' as const, item, index }))
      .filter(({ item }) => item.isSubcontractor)
    return [...rental, ...sub]
  }, [equipmentItems, productionItems])

  const stageById = useMemo(() => {
    const m = new Map<string, Partial<OrderStage>>()
    for (const s of stages) {
      if (s?.id) m.set(String(s.id), s)
    }
    return m
  }, [stages])

  const stageTypeLabelPl = (type?: string | null): string => {
    if (!type) return '—'
    const map: Record<string, string> = {
      MONTAZ: 'Montaż',
      EVENT: 'Wydarzenie',
      DEMONTAZ: 'Demontaż',
      CUSTOM: 'Inny',
    }
    return map[type] ?? String(type)
  }

  const parseStageId = (stageIds?: unknown): string | null => {
    if (!stageIds) return null
    if (typeof stageIds !== 'string') return null
    try {
      const parsed = JSON.parse(stageIds) as unknown
      if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed[0] ?? null
      return null
    } catch {
      return null
    }
  }

  const formatStageInfo = (stageIds?: unknown): string | null => {
    const stageId = parseStageId(stageIds)
    if (!stageId) return null
    const s = stageById.get(stageId)
    if (!s) return null
    const dateStr = s.date ? new Date(s.date as any).toLocaleDateString('pl') : ''
    const typeStr = stageTypeLabelPl(s.type as any)
    const label = typeof s.label === 'string' && s.label.trim() ? s.label.trim() : ''
    const parts = [dateStr, typeStr, label].filter(Boolean)
    return parts.length ? parts.join(' ') : null
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="border border-border rounded-lg p-3 bg-surface-2">
          <h4 className="font-semibold mb-2">Kalkulacja</h4>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Przychód netto</span>
              <span className="font-medium">{summary.revenueNet.toFixed(2)} PLN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rabat</span>
              <span className="text-red-500 font-medium">-{summary.discountAmount.toFixed(2)} PLN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Netto po rabacie</span>
              <span className="font-medium">{summary.netAfterDiscount.toFixed(2)} PLN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT ({order.vatRate || 23}%)</span>
              <span className="font-medium">{summary.vatAmount.toFixed(2)} PLN</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-border">
              <span className="font-medium">Brutto</span>
              <span className="font-semibold text-primary">{summary.grossTotal.toFixed(2)} PLN</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Rabat ogólny %</label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  className="flex-1 min-w-0 h-2"
                  value={order.discountGlobal ?? 0}
                  onChange={(e) => handleChange('discountGlobal', parseFloat(e.target.value) || 0)}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className="w-16 px-2 py-1 text-sm bg-background border border-border rounded text-right tabular-nums"
                  value={order.discountGlobal ?? 0}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!Number.isNaN(v)) handleChange('discountGlobal', Math.min(100, Math.max(0, v)))
                  }}
                />
                <span className="text-sm font-medium">%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Stawka VAT</label>
              <select
                className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded"
                value={order.vatRate ?? 23}
                onChange={(e) => handleChange('vatRate', parseInt(e.target.value) || 0)}
              >
                <option value="23">23%</option>
                <option value="0">0% (kontrahent UE)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg p-3 bg-surface-2">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-semibold">Zysk</h4>
            <button
              type="button"
              disabled={marginRows.length === 0}
              title={
                marginRows.length === 0
                  ? 'Brak pozycji z rental lub podwykonawcą'
                  : 'Ustal koszt pod rental / podwykonawcę (opcjonalnie)'
              }
              onClick={() => setMarginModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded border border-border bg-background hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <SlidersHorizontal size={14} />
              Koszty marży
            </button>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Koszt podwykonawców</span>
              <span className="text-amber-500 font-medium">{summary.subcontractorTotal.toFixed(2)} PLN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Wartość rentalu</span>
              <span className="text-amber-500 font-medium">{summary.rentalTotal.toFixed(2)} PLN</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-border">
              <span className="text-muted-foreground">Zysk netto</span>
              <span className={summary.ownMarginNet >= 0 ? 'text-green-500 font-semibold' : 'text-red-500 font-semibold'}>
                {summary.ownMarginNet.toFixed(2)} PLN
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Zysk %</span>
              <span className={summary.marginPercent >= 0 ? 'text-green-500 font-semibold' : 'text-red-500 font-semibold'}>
                {summary.marginPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg p-3 bg-surface-2">
          <h4 className="font-semibold mb-2">Notatki</h4>
          <textarea
            className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded min-h-[112px]"
            placeholder="Uwagi wewnętrzne (niezależne od opisu zlecenia)..."
            value={order.notes ?? ''}
            onChange={(e) => handleChange('notes', e.target.value)}
          />
        </div>
      </div>

      {marginModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMarginModalOpen(false)
          }}
        >
          <div
            className="bg-surface border border-border rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="margin-cost-dialog-title"
          >
            <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
              <h2 id="margin-cost-dialog-title" className="text-lg font-bold">
                Koszty marży (rental / podwykonawca)
              </h2>
              <button
                type="button"
                onClick={() => setMarginModalOpen(false)}
                className="p-1 rounded hover:bg-surface-2"
                aria-label="Zamknij"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto text-sm space-y-3">
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-xs min-w-[720px]">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border text-left">
                      <th className="py-2 px-2 font-medium text-muted-foreground w-28">Typ</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">Nazwa</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Netto poz.</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">Ilość (koszt)</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground">Koszt netto / jedn.</th>
                      <th className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Od marży</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marginRows.map((row) => {
                      if (row.kind === 'equipment') {
                        const { item, index } = row
                        const lineNet = computeEquipmentLineNet(item)
                        const ded = computeRentalMarginDeduction(item)
                        const qty = item.quantity ?? 1
                        const days = item.days ?? 1
                        return (
                          <tr key={`eq-${index}`} className="border-b border-border/60">
                            <td className="py-2 px-2 whitespace-nowrap">Rental</td>
                            <td className="py-2 px-2">
                              <div className="leading-tight">
                                <div>{item.name || '—'}</div>
                                <div className="text-muted-foreground">
                                  Ilość: <span className="tabular-nums">{qty}</span>
                                  {days != null ? (
                                    <>
                                      {' '}
                                      · Dni: <span className="tabular-nums">{days}</span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-2 tabular-nums whitespace-nowrap">{lineNet.toFixed(2)} PLN</td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                className="w-full min-w-[5rem] px-2 py-1 bg-background border border-border rounded tabular-nums"
                                placeholder="—"
                                value={item.marginRentalUnits ?? ''}
                                onChange={(e) => {
                                  const raw = e.target.value
                                  if (raw === '') {
                                    onEquipmentMarginPatch(index, { marginRentalUnits: null })
                                    return
                                  }
                                  const v = parseFloat(raw)
                                  if (!Number.isNaN(v)) onEquipmentMarginPatch(index, { marginRentalUnits: v })
                                }}
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                className="w-full min-w-[5rem] px-2 py-1 bg-background border border-border rounded tabular-nums"
                                placeholder="—"
                                value={item.marginRentalUnitCostNet ?? ''}
                                onChange={(e) => {
                                  const raw = e.target.value
                                  if (raw === '') {
                                    onEquipmentMarginPatch(index, { marginRentalUnitCostNet: null })
                                    return
                                  }
                                  const v = parseFloat(raw)
                                  if (!Number.isNaN(v)) onEquipmentMarginPatch(index, { marginRentalUnitCostNet: v })
                                }}
                              />
                            </td>
                            <td className="py-2 px-2 tabular-nums font-medium whitespace-nowrap">{ded.toFixed(2)} PLN</td>
                          </tr>
                        )
                      }
                      const { item, index } = row
                      const lineNet = computeProductionLineNet(item)
                      const ded = computeSubcontractorMarginDeduction(item)
                      const stageInfo = formatStageInfo(item.stageIds)
                      return (
                        <tr key={`pr-${index}`} className="border-b border-border/60">
                          <td className="py-2 px-2 whitespace-nowrap">Podwykonawca</td>
                          <td className="py-2 px-2">
                            <div className="leading-tight">
                              <div>
                                {item.name || '—'}
                                {item.isTransport ? (
                                  <span className="ml-1 text-muted-foreground">(transport)</span>
                                ) : null}
                              </div>
                              <div className="text-muted-foreground">
                                Ilość: <span className="tabular-nums">{item.units ?? 1}</span>
                                {stageInfo ? (
                                  <>
                                    {' '}
                                    · Etap: <span className="text-foreground">{stageInfo}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-2 tabular-nums whitespace-nowrap">{lineNet.toFixed(2)} PLN</td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              className="w-full min-w-[5rem] px-2 py-1 bg-background border border-border rounded tabular-nums"
                              placeholder="—"
                              value={item.marginSubcontractorUnits ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value
                                if (raw === '') {
                                  onProductionMarginPatch(index, { marginSubcontractorUnits: null })
                                  return
                                }
                                const v = parseFloat(raw)
                                if (!Number.isNaN(v)) onProductionMarginPatch(index, { marginSubcontractorUnits: v })
                              }}
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              className="w-full min-w-[5rem] px-2 py-1 bg-background border border-border rounded tabular-nums"
                              placeholder="—"
                              value={item.marginSubcontractorUnitCostNet ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value
                                if (raw === '') {
                                  onProductionMarginPatch(index, { marginSubcontractorUnitCostNet: null })
                                  return
                                }
                                const v = parseFloat(raw)
                                if (!Number.isNaN(v)) onProductionMarginPatch(index, { marginSubcontractorUnitCostNet: v })
                              }}
                            />
                          </td>
                          <td className="py-2 px-2 tabular-nums font-medium whitespace-nowrap">{ded.toFixed(2)} PLN</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-3 border-t border-border flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setMarginModalOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded border-2 border-primary text-primary hover:bg-primary/10"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
