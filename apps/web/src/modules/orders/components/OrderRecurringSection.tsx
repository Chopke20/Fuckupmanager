import { useFormContext, Controller } from 'react-hook-form'
import { Switch } from '@radix-ui/react-switch'
import { Repeat } from 'lucide-react'
import type { Order } from '@lama-stage/shared-types'

interface OrderRecurringSectionProps {
  valueForOneEvent?: number
  marginForOneEvent?: number
}

type RecurringConfig = {
  repetitions?: number
  dates?: string[]
}

export default function OrderRecurringSection({
  valueForOneEvent = 0,
  marginForOneEvent = 0,
}: OrderRecurringSectionProps) {
  const { watch, setValue, control } = useFormContext<Partial<Order>>()

  const recurringConfigRaw = watch('recurringConfig')
  let repetitions = 0
  let dates: string[] = []
  try {
    if (typeof recurringConfigRaw === 'string' && recurringConfigRaw) {
      const parsed = JSON.parse(recurringConfigRaw) as RecurringConfig
      repetitions = Math.max(0, Math.min(99, Number(parsed?.repetitions) || 0))
      dates = Array.isArray(parsed?.dates) ? parsed.dates.map((d) => String(d || '').slice(0, 10)) : []
    }
  } catch {
    //
  }

  const updateRecurringConfig = (next: RecurringConfig) => {
    const n = Math.max(0, Math.min(99, Number(next.repetitions) || 0))
    const normalizedDates = (next.dates ?? [])
      .map((d) => String(d || '').slice(0, 10))
      .slice(0, n)
    setValue('recurringConfig', n > 0 ? JSON.stringify({ repetitions: n, dates: normalizedDates }) : '', { shouldDirty: true })
  }

  const handleRepetitionsChange = (value: number) => {
    const n = Math.max(0, Math.min(99, value))
    const nextDates = [...dates]
    while (nextDates.length < n) nextDates.push('')
    updateRecurringConfig({ repetitions: n, dates: nextDates.slice(0, n) })
  }

  const handleDateChange = (index: number, value: string) => {
    const nextDates = [...dates]
    while (nextDates.length < repetitions) nextDates.push('')
    nextDates[index] = value.slice(0, 10)
    updateRecurringConfig({ repetitions, dates: nextDates })
  }

  const totalEvents = 1 + repetitions
  const valueForCycle = valueForOneEvent * totalEvents
  const marginForCycle = marginForOneEvent * totalEvents

  return (
    <div className="border border-border rounded-lg p-4 bg-surface-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Repeat size={18} className="text-muted-foreground" />
          <h3 className="text-base font-semibold">Zlecenia cykliczne</h3>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="recurring-switch" className="text-sm font-medium text-foreground cursor-pointer">
            Włącz zlecenie cykliczne
          </label>
          <Controller
            name="isRecurring"
            control={control}
            defaultValue={false}
            render={({ field }) => (
              <Switch
                id="recurring-switch"
                checked={!!field.value}
                onCheckedChange={(checked) => field.onChange(!!checked)}
                className="data-[state=checked]:bg-primary"
              />
            )}
          />
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {watch('isRecurring') ? 'Włączone' : 'Wyłączone'}
          </span>
        </div>
      </div>

      {watch('isRecurring') && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Wydarzenie powtórzy się jeszcze (razy)</label>
            <input
              type="number"
              min={0}
              max={99}
              className="w-24 px-2 py-1.5 text-sm bg-background border border-border rounded"
              value={repetitions}
              onChange={(e) => handleRepetitionsChange(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          {repetitions > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Daty kolejnych eventów (opcjonalnie)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {Array.from({ length: repetitions }).map((_, index) => (
                  <input
                    key={`rec-date-${index}`}
                    type="date"
                    className="px-2 py-1.5 text-sm bg-background border border-border rounded"
                    value={dates[index] || ''}
                    onChange={(e) => handleDateChange(index, e.target.value)}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="text-sm border-t border-border pt-3">
            <div className="flex justify-between text-muted-foreground">
              <span>Za 1 event (kwota):</span>
              <span className="font-medium text-foreground">{valueForOneEvent.toFixed(2)} PLN</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Za 1 event (zysk):</span>
              <span className={marginForOneEvent >= 0 ? 'font-medium text-green-500' : 'font-medium text-red-500'}>
                {marginForOneEvent.toFixed(2)} PLN
              </span>
            </div>
            {repetitions > 0 && (
              <>
                <div className="flex justify-between mt-1 text-muted-foreground">
                  <span>Łącznie za cykl ({totalEvents} eventów):</span>
                  <span className="font-bold text-primary">{valueForCycle.toFixed(2)} PLN</span>
                </div>
                <div className="flex justify-between mt-1 text-muted-foreground">
                  <span>Zysk za cykl ({totalEvents} eventów):</span>
                  <span className={marginForCycle >= 0 ? 'font-bold text-green-500' : 'font-bold text-red-500'}>
                    {marginForCycle.toFixed(2)} PLN
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!watch('isRecurring') && (
        <p className="text-sm text-muted-foreground mt-2">
          Włącz, jeśli to samo wydarzenie odbędzie się jeszcze kilka razy – zobaczysz kalkulację za cykl (punkt wyjścia do oferty PDF).
        </p>
      )}
    </div>
  )
}
