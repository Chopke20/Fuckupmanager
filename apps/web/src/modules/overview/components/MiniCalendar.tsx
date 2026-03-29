import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useOrders } from '../../orders/hooks/useOrders'
import type { OrderStage } from '@lama-stage/shared-types'

const STAGE_COLORS: Record<string, string> = {
  MONTAZ: '#3b82f6',   // niebieski
  EVENT: '#22c55e',    // zielony
  DEMONTAZ: '#f59e0b', // pomarańczowy
  CUSTOM: '#8b5cf6',   // fioletowy
}

export default function MiniCalendar() {
  const { data: paginatedOrders } = useOrders()
  const orders = paginatedOrders?.data || []
  const [currentDate, setCurrentDate] = useState(new Date())
  const [eventsByDate, setEventsByDate] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const events: Record<string, string[]> = {}

    orders.forEach(order => {
      order.stages?.forEach((stage: OrderStage) => {
        const stageDate = stage.date
        if (stageDate) {
          try {
            const dateStr = new Date(stageDate).toISOString().split('T')[0]
            if (dateStr) {
              if (!events[dateStr]) {
                events[dateStr] = []
              }
              events[dateStr]!.push(`${order.name} - ${stage.type}`)
            }
          } catch (error) {
            console.error('Błąd parsowania daty etapu:', error)
          }
        }
      })
    })

    setEventsByDate(events)
  }, [orders])

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay()
    return day === 0 ? 6 : day - 1 // Convert to Monday-first (0 = Monday)
  }

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthNames = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
  ] as const
  const dayNames = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'] as const

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date()
  const isToday = (day: number) => {
    return day === today.getDate() && 
           month === today.getMonth() && 
           year === today.getFullYear()
  }

  const days = []
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  const getEventsForDay = (day: number) => {
    try {
      const dateStr = new Date(year, month, day).toISOString().split('T')[0]
      return dateStr ? (eventsByDate[dateStr] || []) : []
    } catch (error) {
      console.error('Błąd pobierania wydarzeń dla dnia:', error)
      return []
    }
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Kalendarz miesięczny</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-surface-2 rounded-lg transition-colors"
            aria-label="Poprzedni miesiąc"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-medium min-w-[140px] text-center">
            {monthNames[month as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-surface-2 rounded-lg transition-colors"
            aria-label="Następny miesiąc"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="h-10" />
          }

          const events = getEventsForDay(day)
          const hasEvents = events.length > 0
          const todayClass = isToday(day) ? 'ring-2 ring-primary' : ''

          return (
            <div
              key={day}
              className={`relative h-10 flex items-center justify-center rounded-lg transition-colors
                ${hasEvents ? 'bg-blue-500/10 hover:bg-blue-500/20' : 'hover:bg-surface-2'}
                ${todayClass}`}
            >
              <span className={`font-medium ${isToday(day) ? 'text-primary' : ''}`}>
                {day}
              </span>
              
              {hasEvents && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                  {events.slice(0, 3).map((_: any, i: number) => (
                    <div
                      key={i}
                      className="w-1 h-1 rounded-full bg-blue-500"
                    />
                  ))}
                  {events.length > 3 && (
                    <div className="w-1 h-1 rounded-full bg-blue-300" />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Wydarzenia ({Object.keys(eventsByDate).length} dni)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full ring-2 ring-primary" />
            <span className="text-muted-foreground">Dzisiaj</span>
          </div>
        </div>
      </div>
    </div>
  )
}