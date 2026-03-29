import { Order, OrderEquipmentItem, OrderProductionItem } from '@lama-stage/shared-types'
import { calculateOrderFinancialSummary } from '../utils/orderFinancialSummary'

interface OrderFinancialSectionProps {
  order: Partial<Order>
  equipmentItems: Partial<OrderEquipmentItem>[]
  productionItems: Partial<OrderProductionItem>[]
  onChange: (updates: Partial<Order>) => void
}

export default function OrderFinancialSection({
  order,
  equipmentItems = [],
  productionItems = [],
  onChange,
}: OrderFinancialSectionProps) {
  const summary = calculateOrderFinancialSummary(order, equipmentItems, productionItems)

  const handleChange = (field: keyof Order, value: any) => {
    onChange({ [field]: value })
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
          <h4 className="font-semibold mb-2">Zysk</h4>
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
    </div>
  )
}