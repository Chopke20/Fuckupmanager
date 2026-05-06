import { useState, useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { Order, OrderStage } from '@lama-stage/shared-types'
import { dateInputToISO, isoToDateInput, daysBetween } from '../../../shared/utils/dateHelpers'
import { randomClientUuid } from '../../../shared/utils/uuid'

interface OrderScheduleSectionProps {
  /** Data rozpoczęcia zlecenia – pierwsza proponowana data przy dodawaniu etapu */
  orderDateFrom?: string | null
  onChange?: (stages: OrderStage[]) => void
}

export default function OrderScheduleSection({ orderDateFrom, onChange }: OrderScheduleSectionProps) {
  const { watch } = useFormContext<Partial<Order>>()
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  const stages = watch('stages') || []

  const stageTypes = [
    { value: 'MONTAZ', label: 'Montaż' },
    { value: 'EVENT', label: 'Wydarzenie' },
    { value: 'DEMONTAZ', label: 'Demontaż' },
    { value: 'CUSTOM', label: 'Inny' },
  ]

  const addStage = () => {
    const proposedDate =
      orderDateFrom && /^\d{4}-\d{2}-\d{2}/.test(orderDateFrom)
        ? new Date(orderDateFrom).toISOString()
        : new Date().toISOString()
    const newStage: Partial<OrderStage> = {
      id: randomClientUuid(),
      orderId: '',
      type: 'CUSTOM',
      label: '',
      date: proposedDate,
      timeStart: '09:00',
      timeEnd: '17:00',
      notes: '',
      sortOrder: stages.length,
      createdAt: new Date().toISOString(),
    }
    onChange?.([...stages, newStage])
  }

  const updateStage = (index: number, updates: Partial<OrderStage>) => {
    const updated = [...stages]
    updated[index] = { ...(updated[index] || {}), ...updates }
    onChange?.(updated)
  }

  const removeStage = (index: number) => {
    const updated = stages.filter((_: any, i: number) => i !== index)
    const withOrder = updated.map((s: any, idx: number) => ({ ...s, sortOrder: idx }))
    onChange?.(withOrder)
  }

  const moveStage = (fromIndex: number, toIndex: number) => {
    const updated = [...stages]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    const reordered = updated.map((stage: any, idx: number) => ({ ...stage, sortOrder: idx }))
    onChange?.(reordered)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (Number.isNaN(fromIndex) || fromIndex === dropIndex) return
    moveStage(fromIndex, dropIndex)
    setDraggingIndex(null)
  }

  /** Zakres kalendarzowy od najwcześniejszego do najpóźniejszego etapu (te same zasady co „dni zlecenia” w sprzęcie) */
  const scheduleSpanDays = useMemo(() => {
    const dates = stages
      .map((s: any) => (s?.date ? new Date(s.date as string | Date) : null))
      .filter((d: Date | null): d is Date => Boolean(d && !Number.isNaN(d.getTime())))
    if (dates.length === 0) return null
    const tMin = Math.min(...dates.map((d: Date) => d.getTime()))
    const tMax = Math.max(...dates.map((d: Date) => d.getTime()))
    return daysBetween(new Date(tMin), new Date(tMax))
  }, [stages])

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold">Harmonogram</h3>
        <span className="text-sm text-muted-foreground" title="Liczba dni kalendarzowych od pierwszej do ostatniej daty etapu (włącznie)">
          {scheduleSpanDays != null ? (
            <>
              Zakres: <strong>{scheduleSpanDays}</strong> {scheduleSpanDays === 1 ? 'dzień' : 'dni'}
            </>
          ) : (
            <>Zakres: —</>
          )}
        </span>
      </div>

      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 border-b border-border">
              <th className="w-8 py-1.5 px-1"></th>
              <th className="text-left py-1.5 px-2 font-medium">Typ</th>
              <th className="text-left py-1.5 px-2 font-medium">Nazwa</th>
              <th className="text-left py-1.5 px-2 font-medium">Data</th>
              <th className="text-left py-1.5 px-2 font-medium">Od</th>
              <th className="text-left py-1.5 px-2 font-medium">Do</th>
              <th className="text-left py-1.5 px-2 font-medium">Notatki</th>
              <th className="w-9 py-1.5 px-1"></th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage: any, index: number) => (
              <tr
                key={stage.id || index}
                className={`border-b border-border/50 hover:bg-surface-2/50 ${draggingIndex === index ? 'opacity-50' : ''}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, index)}
              >
                <td
                  className="py-1 px-1 cursor-move text-muted-foreground"
                  title="Przeciągnij"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(index))
                    setDraggingIndex(index)
                  }}
                >
                  <GripVertical size={16} />
                </td>
                <td className="py-1 px-2">
                  <select
                    className="w-full min-w-[90px] px-2 py-1 bg-background border border-border rounded text-xs"
                    value={stage.type || 'CUSTOM'}
                    onChange={(e) => updateStage(index, { type: e.target.value as any })}
                  >
                    {stageTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </td>
                <td className="py-1 px-2">
                  {String(stage.type || 'CUSTOM') === 'CUSTOM' ? (
                    <input
                      type="text"
                      className="w-full min-w-[140px] px-2 py-1 bg-background border border-border rounded text-xs"
                      value={stage.label || ''}
                      onChange={(e) => updateStage(index, { label: e.target.value })}
                      placeholder="Wpisz własną nazwę (np. Próba, Setup)"
                    />
                  ) : (
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {stageTypes.find((t) => t.value === String(stage.type))?.label || String(stage.type || '')}
                    </div>
                  )}
                </td>
                <td className="py-1 px-2">
                  <input
                    type="date"
                    className="w-full min-w-[120px] px-2 py-1 bg-background border border-border rounded text-xs"
                    value={stage.date ? isoToDateInput(stage.date) : ''}
                    onChange={(e) => {
                    const iso = dateInputToISO(e.target.value)
                    if (iso) updateStage(index, { date: iso })
                  }}
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    type="time"
                    className="w-full min-w-[80px] px-2 py-1 bg-background border border-border rounded text-xs"
                    value={stage.timeStart || ''}
                    onChange={(e) => updateStage(index, { timeStart: e.target.value })}
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    type="time"
                    className="w-full min-w-[80px] px-2 py-1 bg-background border border-border rounded text-xs"
                    value={stage.timeEnd || ''}
                    onChange={(e) => updateStage(index, { timeEnd: e.target.value })}
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    type="text"
                    className="w-full min-w-[100px] px-2 py-1 bg-background border border-border rounded text-xs"
                    value={stage.notes || ''}
                    onChange={(e) => updateStage(index, { notes: e.target.value })}
                    placeholder="Notatki"
                  />
                </td>
                <td className="py-1 px-1">
                  <button
                    type="button"
                    onClick={() => removeStage(index)}
                    className="p-1 text-red-500 hover:text-red-700"
                    title="Usuń"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-2 border-t border-border">
              <td colSpan={8} className="py-1.5 px-2">
                <button
                  type="button"
                  onClick={addStage}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Plus size={14} />
                  Dodaj wiersz
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
