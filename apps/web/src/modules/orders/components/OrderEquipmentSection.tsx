import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Trash2, Eye, EyeOff, Copy, AlertCircle, CheckCircle2, XCircle, X, Plus, Info } from 'lucide-react'
import { OrderEquipmentItem, Equipment } from '@lama-stage/shared-types'
import { useEquipment } from '../../equipment/hooks/useEquipment'
import { orderApi, EquipmentAvailabilityItem } from '../api/order.api'
interface OrderEquipmentSectionProps {
  items: Partial<OrderEquipmentItem>[]
  onChange: (items: Partial<OrderEquipmentItem>[]) => void
  /** Jeśli edytujemy zlecenie – wyklucz je z konfliktów */
  excludeOrderId?: string
  orderDateFrom?: string
  orderDateTo?: string
  /**
   * Liczba dni zlecenia (inclusive) z zakresu dateFrom–dateTo.
   * Używana: podpowiedź „zlecenie:” w nagłówku; nowe wiersze biorą dni z pola w nawiasach, jeśli jest tam poprawna liczba.
   */
  orderSpanDays?: number
}

export default function OrderEquipmentSection({
  items = [],
  onChange,
  excludeOrderId,
  orderDateFrom,
  orderDateTo,
  orderSpanDays = 1,
}: OrderEquipmentSectionProps) {
  const normalizeCategoryName = (value: string): string => {
    const normalized = value.trim()
    const upper = normalized.toUpperCase()
    const map: Record<string, string> = {
      AUDIO: 'Audio',
      MULTIMEDIA: 'Multimedia',
      SCENA: 'Scena',
      STREAM: 'Multimedia',
      TRANSPORT: 'Transport',
      'ŚWIATŁO': 'Oświetlenie',
      OŚWIETLENIE: 'Oświetlenie',
      INNE: 'Inne',
    }
    return map[upper] || normalized
  }

  const { data: paginatedEquipment } = useEquipment({ page: 1, limit: 500 })
  const equipmentList = paginatedEquipment?.data || []
  const [equipmentAvailability, setEquipmentAvailability] = useState<Map<string, EquipmentAvailabilityItem>>(new Map())
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)
  const [conflictBannerDismissed, setConflictBannerDismissed] = useState(false)
  const [availabilityModalItem, setAvailabilityModalItem] = useState<{ item: Partial<OrderEquipmentItem>; index: number } | null>(null)

  /** Wpis w nagłówku „Dni (…)”: odświeżany przy zmianie długości zlecenia; blur = jednorazowo ustawia dni we wszystkich wierszach */
  const [bulkDaysDraft, setBulkDaysDraft] = useState(() => String(Math.max(1, orderSpanDays)))
  const prevOrderSpanRef = useRef(orderSpanDays)
  const bulkHeaderFocused = useRef(false)
  const bulkDaysDraftAtFocusRef = useRef<string | null>(null)

  useEffect(() => {
    if (bulkHeaderFocused.current) return
    if (prevOrderSpanRef.current !== orderSpanDays) {
      prevOrderSpanRef.current = orderSpanDays
      setBulkDaysDraft(String(Math.max(1, orderSpanDays)))
    }
  }, [orderSpanDays])

  const applyBulkDaysToAllRows = useCallback(() => {
    const parsed = parseInt(bulkDaysDraft, 10)
    const n = Number.isFinite(parsed) && parsed >= 1 ? Math.round(parsed) : Math.max(1, orderSpanDays)
    setBulkDaysDraft(String(n))
    onChange(items.map((item) => ({ ...item, days: n })))
  }, [bulkDaysDraft, items, onChange, orderSpanDays])

  const handleBulkDaysFocus = () => {
    bulkHeaderFocused.current = true
    bulkDaysDraftAtFocusRef.current = bulkDaysDraft
  }

  const handleBulkDaysBlur = () => {
    bulkHeaderFocused.current = false
    const before = bulkDaysDraftAtFocusRef.current
    bulkDaysDraftAtFocusRef.current = null
    if (before !== bulkDaysDraft) {
      applyBulkDaysToAllRows()
    }
  }

  /** Nowe wiersze biorą dni z nagłówka (jeśli jest sensowna liczba), inaczej ze zlecenia */
  const daysForNewRows = useMemo(() => {
    const parsed = parseInt(bulkDaysDraft, 10)
    if (Number.isFinite(parsed) && parsed >= 1) return Math.round(parsed)
    return Math.max(1, orderSpanDays)
  }, [bulkDaysDraft, orderSpanDays])

  const categories = Array.from(
    new Set(equipmentList.map((eq) => normalizeCategoryName(eq.category)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))

  /** Podpowiedzi kategorii dla własnych pozycji (bez powiązania z magazynem) — można też wpisać dowolną nazwę. */
  const categoryDatalistOptions = useMemo(() => {
    const defaults = ['Audio', 'Multimedia', 'Scena', 'Oświetlenie', 'Transport', 'Inne']
    const merged = [...categories, ...defaults.map((d) => normalizeCategoryName(d))]
    return Array.from(new Set(merged.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pl'))
  }, [categories])

  // Sprawdź dostępność sprzętu
  const checkAvailability = useCallback(async (equipmentIds: string[], quantityByEq: Map<string, number>) => {
    if (!equipmentIds.length || !orderDateFrom || !orderDateTo) return

    try {
      setIsCheckingAvailability(true)
      const requests = Array.from(quantityByEq.entries()).map(([equipmentId, quantity]) => ({
        equipmentId,
        quantity,
      }))

      const response = await orderApi.checkEquipmentAvailability({
        equipmentIds,
        dateFrom: orderDateFrom,
        dateTo: orderDateTo,
        excludeOrderId,
        requests,
      })

      const availabilityMap = new Map<string, EquipmentAvailabilityItem>()
      response.data.forEach((item) => {
        availabilityMap.set(item.equipmentId, item)
      })
      setEquipmentAvailability(availabilityMap)
    } catch (error) {
      console.error('Błąd sprawdzania dostępności:', error)
    } finally {
      setIsCheckingAvailability(false)
    }
  }, [orderDateFrom, orderDateTo, excludeOrderId])

  // Sprawdź dostępność przy zmianie dat lub pozycji sprzętu (debounce 500 ms)
  const quantityByEquipment = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      if (!item.equipmentId) continue
      const prev = map.get(item.equipmentId as string) ?? 0
      map.set(item.equipmentId as string, prev + (item.quantity || 1))
    }
    return map
  }, [items])

  const equipmentIds = Array.from(quantityByEquipment.keys())
  const availabilityKey = equipmentIds.join(',') + '|' + JSON.stringify(Array.from(quantityByEquipment.entries())) + '|' + (orderDateFrom ?? '') + '|' + (orderDateTo ?? '')
  useEffect(() => {
    if (equipmentIds.length === 0) {
      setEquipmentAvailability(new Map())
      return
    }
    const t = setTimeout(() => {
      checkAvailability(equipmentIds, quantityByEquipment)
    }, 500)
    return () => clearTimeout(t)
  }, [availabilityKey, orderDateFrom, orderDateTo, checkAvailability, quantityByEquipment])

  const addEmptyRow = () => {
    const newItem: Partial<OrderEquipmentItem> = {
      id: `temp-${Date.now()}`,
      orderId: '',
      equipmentId: undefined,
      equipment: undefined,
      name: '',
      description: '',
      category: 'Inne',
      quantity: 1,
      unitPrice: 0,
      days: daysForNewRows,
      discount: 0,
      pricingRule: { day1: 1.0, nextDays: 0.5 },
      visibleInOffer: true,
      isRental: false,
      sortOrder: items.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    onChange([...items, newItem])
  }

  const addEquipmentFromCatalog = (eq: Equipment) => {
    const newItem: Partial<OrderEquipmentItem> = {
      id: `temp-${Date.now()}`,
      orderId: '',
      equipmentId: eq.id,
      equipment: eq,
      name: eq.name,
      description: '',
      category: normalizeCategoryName(eq.category),
      quantity: 1,
      unitPrice: eq.dailyPrice,
      days: daysForNewRows,
      discount: 0,
      pricingRule: eq.pricingRule || { day1: 1.0, nextDays: 0.5 },
      visibleInOffer: eq.visibleInOffer,
      isRental: false,
      sortOrder: items.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    onChange([...items, newItem])
  }

  const updateItem = (index: number, updates: Partial<OrderEquipmentItem>) => {
    const updated = [...items]
    updated[index] = { ...updated[index], ...updates }
    onChange(updated)
  }

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index)
    onChange(updated)
  }

  const duplicateItem = (index: number) => {
    const item = items[index]
    const newItem = {
      ...item,
      id: `temp-${Date.now()}`,
      sortOrder: items.length,
    }
    onChange([...items, newItem])
  }

  const calculateItemTotal = (item: Partial<OrderEquipmentItem>) => {
    const base = (item.unitPrice || 0) * (item.quantity || 1)
    const day1Multiplier = item.pricingRule?.day1 ?? 1.0
    const nextDaysMultiplier = item.pricingRule?.nextDays ?? 0.5
    const firstDayValue = base * day1Multiplier
    const extraDaysValue = (item.days || 1) > 1 ? ((item.days || 1) - 1) * base * nextDaysMultiplier : 0
    const multiDay = firstDayValue + extraDaysValue
    const afterDiscount = multiDay * (1 - (item.discount || 0) / 100)
    return afterDiscount
  }

  const totalValue = items.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  const rentalValue = items
    .filter((item) => item.isRental)
    .reduce((sum, item) => sum + calculateItemTotal(item), 0)

  return (
    <div className="space-y-3">
      <datalist id="equipment-datalist">
        {equipmentList.filter((e) => e.category !== 'ZASOBY').map((eq) => (
          <option key={eq.id} value={eq.name} />
        ))}
      </datalist>
      <datalist id="order-equipment-category-datalist">
        {categoryDatalistOptions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold">Wykaz sprzętu</h3>
        {isCheckingAvailability && <span className="text-sm text-blue-500">Sprawdzanie dostępności…</span>}
      </div>

      {/* Tabela jak harmonogram – spójny wygląd, nazwa ma miejsce */}
      <div className="border border-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 border-b border-border">
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground w-8">#</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground min-w-[200px]">Nazwa</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Kategoria</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Ilość</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Cena jdn.</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground align-top min-w-[6.5rem]">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-x-0.5 gap-y-0.5 font-normal">
                      <span className="font-medium text-muted-foreground">Dni</span>
                      <span className="text-muted-foreground">(</span>
                      <input
                        type="number"
                        min={1}
                        className="w-11 px-1 py-0.5 text-xs bg-background border border-border rounded text-right"
                        value={bulkDaysDraft}
                        onFocus={handleBulkDaysFocus}
                        onBlur={handleBulkDaysBlur}
                        onChange={(e) => setBulkDaysDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            ;(e.target as HTMLInputElement).blur()
                          }
                        }}
                        title="Wpisz liczbę dni i zdejmij fokus (Enter) — ustawia dni dla wszystkich pozycji naraz. Pojedyncze wiersze możesz potem zmienić ręcznie."
                      />
                      <span className="text-muted-foreground">)</span>
                    </div>
                    <span className="text-[10px] font-normal text-muted-foreground leading-tight">
                      zlecenie: {Math.max(1, orderSpanDays)}
                    </span>
                  </div>
                </th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Rabat %</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Wartość netto</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground" title="Wynajem – bez marży">Rental</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Dostępność</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Widoczny</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground w-20">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const availability = item.equipmentId ? equipmentAvailability.get(item.equipmentId) : undefined
                const isAvailable = availability?.isAvailable ?? (item.equipmentId ? true : undefined)
                const isUnavailable = item.equipmentId && isAvailable === false

                return (
                  <tr key={item.id || index} className="border-b border-border hover:bg-surface-2/50 transition-colors">
                    <td className="py-1.5 px-3">
                      <div className="text-sm text-muted-foreground">{index + 1}</div>
                    </td>
                    <td className="py-1.5 px-3">
                      <div>
                        <input
                          list="equipment-datalist"
                          type="text"
                          className="w-full px-2 py-0.5 text-sm bg-transparent border border-transparent hover:border-border rounded focus:border-primary focus:outline-none"
                          value={item.name || ''}
                          onChange={(e) => updateItem(index, { name: e.target.value })}
                          onBlur={(e) => {
                            const name = (e.target.value || '').trim()
                            if (!name) return
                            const eq = equipmentList.find((e) => e.name.trim().toLowerCase() === name.toLowerCase())
                            if (eq) updateItem(index, { name: eq.name, equipmentId: eq.id, equipment: eq, unitPrice: eq.dailyPrice, category: normalizeCategoryName(eq.category) })
                          }}
                        />
                        <input
                          type="text"
                          className="w-full px-2 py-0.5 text-sm bg-transparent border border-transparent hover:border-border rounded focus:border-primary focus:outline-none text-muted-foreground mt-1"
                          value={item.description || ''}
                          onChange={(e) => updateItem(index, { description: e.target.value })}
                          placeholder="Opis (opcjonalnie)"
                        />
                      </div>
                    </td>
                    <td className="py-1.5 px-3">
                      {item.equipmentId ? (
                        <span className="inline-flex px-2 py-1 text-xs rounded bg-surface border border-border">
                          {normalizeCategoryName(item.category || 'Inne')}
                        </span>
                      ) : (
                        <input
                          list="order-equipment-category-datalist"
                          type="text"
                          className="w-full min-w-[7.5rem] max-w-[14rem] px-2 py-1 text-xs bg-background border border-border rounded"
                          value={item.category ?? 'Inne'}
                          onChange={(e) => updateItem(index, { category: e.target.value })}
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            updateItem(index, { category: v ? normalizeCategoryName(v) : 'Inne' })
                          }}
                          title="Kategoria w ofercie / PDF — wybierz z listy lub wpisz własną"
                          placeholder="Kategoria"
                        />
                      )}
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="number"
                        min="1"
                        className="w-14 px-2 py-1 text-xs bg-background border border-border rounded text-right"
                        value={item.quantity || 1}
                        onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value) || 1 })}
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-20 px-2 py-1 text-xs bg-background border border-border rounded text-right"
                        value={item.unitPrice || 0}
                        onChange={(e) => updateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="number"
                        min="1"
                        className="w-12 px-2 py-1 text-xs bg-background border border-border rounded text-right"
                        value={item.days || 1}
                        onChange={(e) => updateItem(index, { days: parseInt(e.target.value) || 1 })}
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-14 px-2 py-1 text-xs bg-background border border-border rounded text-right"
                        value={item.discount || 0}
                        onChange={(e) => updateItem(index, { discount: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="py-1 px-2 font-medium text-right text-xs">
                      {calculateItemTotal(item).toFixed(2)} PLN
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="checkbox"
                        checked={!!item.isRental}
                        onChange={(e) => updateItem(index, { isRental: e.target.checked })}
                        title="Wynajem – bez marży"
                      />
                    </td>
                    <td className="py-1 px-2">
                      {item.equipmentId ? (
                        !availability ? (
                          <span className="text-xs text-gray-400">Nie sprawdzono</span>
                        ) : isAvailable ? (
                          <span className="flex items-center gap-1 text-green-500 text-sm">
                            <CheckCircle2 size={14} />
                            Dostępny
                          </span>
                        ) : (
                          <span
                            className="flex items-center gap-1 text-red-500 text-sm"
                            title={`Stan: ${availability.stockQuantity} szt. • Potrzeba: ${availability.requestedQuantity} • Min. dostępne: ${availability.summary.minAvailable}`}
                          >
                            <XCircle size={14} />
                            Niedostępny
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">Własna pozycja</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setAvailabilityModalItem({ item, index })}
                        className="ml-1 p-0.5 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground inline-flex"
                        title="Szczegóły dostępności"
                      >
                        <Info size={14} />
                      </button>
                    </td>
                    <td className="py-1 px-2">
                      <button
                        type="button"
                        onClick={() => updateItem(index, { visibleInOffer: !item.visibleInOffer })}
                        className={`p-1 rounded ${item.visibleInOffer !== false ? 'text-green-500 hover:text-green-700' : 'text-red-500 hover:text-red-700'}`}
                        title={item.visibleInOffer !== false ? 'Widoczny w ofercie' : 'Ukryty w ofercie'}
                      >
                        {item.visibleInOffer !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </td>
                    <td className="py-1 px-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => duplicateItem(index)}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title="Duplikuj"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Usuń"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2 border-t border-border">
                <td colSpan={12} className="py-1.5 px-2">
                  <button
                    type="button"
                    onClick={addEmptyRow}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Plus size={14} />
                    Dodaj wiersz
                  </button>
                </td>
              </tr>
              <tr className="bg-surface-2 border-t border-border">
                <td colSpan={7} className="py-1.5 px-2 text-right font-medium text-sm">
                  Suma netto:
                </td>
                <td className="py-1.5 px-2 font-bold text-right text-sm min-w-[120px] whitespace-nowrap">
                  {totalValue.toFixed(2)} PLN
                </td>
                <td colSpan={4} className="py-1.5 px-2 text-sm text-right min-w-[140px] whitespace-nowrap">
                  <span className="text-amber-500 font-semibold">
                    Rental: {rentalValue.toFixed(2)} PLN
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Ostrzeżenie o niedostępnym sprzęcie (można ukryć i pracować dalej) */}
      {!conflictBannerDismissed && items.some((item) => {
        if (!item.equipmentId) return false
        const availability = equipmentAvailability.get(item.equipmentId)
        const ok = availability?.isAvailable ?? true
        return !ok
      }) && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={20} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-red-500">Uwaga: Część sprzętu jest niedostępna</p>
            <p className="text-sm text-muted-foreground mt-1">
              Niektóre pozycje są niedostępne (konflikt w terminie lub niewystarczający stan magazynowy).
              Możesz zapisać zlecenie mimo to, ale sprawdź stany przed realizacją.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConflictBannerDismissed(true)}
            className="p-1 rounded hover:bg-red-500/20 text-red-500 shrink-0"
            title="Ukryj (możesz kontynuować pracę)"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Informacje */}
      <div className="bg-surface-2 rounded-lg border border-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-medium mb-1">Wycena wielodniowa</p>
            <p className="text-muted-foreground">
              Dzień 1 = 100% ceny, każdy kolejny dzień = +50% ceny podstawowej
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">Widoczność w ofercie</p>
            <p className="text-muted-foreground">
              Pozycje oznaczone jako niewidoczne nie pojawią się w PDF dla klienta
            </p>
          </div>
          <div>
            <p className="font-medium mb-1 flex items-center gap-1">
              <CheckCircle2 className="text-green-500" size={14} />
              Dostępność sprzętu
            </p>
            <p className="text-muted-foreground">
              Sprawdzamy konflikty z innymi zleceniami w tym terminie oraz stan magazynowy (ilość na magazynie).
              Przycisk (i) przy pozycji otwiera szczegóły – w przygotowaniu.
            </p>
          </div>
        </div>
      </div>

      {/* Modal szczegółów dostępności – w przygotowaniu */}
      {availabilityModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setAvailabilityModalItem(null)}>
          <div className="bg-surface border border-border rounded-lg shadow-xl max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Szczegóły dostępności</h3>
              <button type="button" onClick={() => setAvailabilityModalItem(null)} className="p-1 rounded hover:bg-surface-2">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Pozycja: <strong>{availabilityModalItem.item.name || '—'}</strong>
            </p>
            {availabilityModalItem.item.equipmentId ? (() => {
              const a = equipmentAvailability.get(availabilityModalItem.item.equipmentId as string)
              if (!a) {
                return (
                  <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
                    Brak danych dostępności (sprawdź daty zlecenia).
                  </div>
                )
              }
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded border border-border bg-surface-2 p-2">
                      <div className="text-[10px] text-muted-foreground uppercase">Stan</div>
                      <div className="font-semibold">{a.stockQuantity}</div>
                    </div>
                    <div className="rounded border border-border bg-surface-2 p-2">
                      <div className="text-[10px] text-muted-foreground uppercase">Potrzeba</div>
                      <div className="font-semibold">{a.requestedQuantity}</div>
                    </div>
                    <div className="rounded border border-border bg-surface-2 p-2">
                      <div className="text-[10px] text-muted-foreground uppercase">Min. dostępne</div>
                      <div className={`font-semibold ${a.summary.minAvailable >= a.requestedQuantity ? 'text-green-500' : 'text-red-500'}`}>
                        {a.summary.minAvailable}
                      </div>
                    </div>
                  </div>

                  {(!a.isAvailable) ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Co blokuje dostępność</div>
                      {a.conflictingOrders?.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Zlecenia</div>
                          {a.conflictingOrders.map((o) => (
                            <a
                              key={o.orderId}
                              href={`/orders/${o.orderId}`}
                              className="block text-sm border border-border rounded px-3 py-2 hover:bg-surface-2"
                            >
                              <div className="font-medium">{o.orderName}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(o.dateFrom).toLocaleDateString()} – {new Date(o.dateTo).toLocaleDateString()}
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                      {a.conflictingBlocks?.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Rezerwacje sprzętu (kalendarz)</div>
                          {a.conflictingBlocks.map((b) => (
                            <div key={b.blockId} className="text-sm border border-border rounded px-3 py-2 bg-surface-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-medium">Rezerwacja sprzętu</div>
                                <a
                                  href={`/?blockId=${encodeURIComponent(b.blockId)}`}
                                  className="text-xs text-primary hover:underline shrink-0"
                                  title="Otwórz w kalendarzu"
                                >
                                  Otwórz
                                </a>
                              </div>
                              {b.note && <div className="text-xs text-muted-foreground mt-0.5">{b.note}</div>}
                              <div className="text-xs text-muted-foreground">
                                {new Date(b.dateFrom).toLocaleDateString()} – {new Date(b.dateTo).toLocaleDateString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-200">
                      Sprzęt jest dostępny w podanym terminie dla zadanej ilości.
                    </div>
                  )}
                </div>
              )
            })() : (
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
                To jest własna pozycja (bez powiązania z magazynem).
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}