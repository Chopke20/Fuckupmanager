import { useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Tooltip } from 'react-tooltip'
import 'react-tooltip/dist/react-tooltip.css'
import { useOrders } from '../../orders/hooks/useOrders'
import type { Order } from '@lama-stage/shared-types'

const STATUS_COLORS = {
  DRAFT: '#94a3b8', 
  CONFIRMED: '#3b82f6', 
  OFFER_SENT: '#f59e0b', 
  COMPLETED: '#10b981', 
  ARCHIVED: '#64748b'
} as const

const eventMinHeight = 24;
const eventDefaultHeight = 32;


interface FullCalendarEvent {
  title: string
  start: string
  end: string
  extendedProps: {
    order: Order
    status: keyof typeof STATUS_COLORS
    clientName: string
    totalNet: number
  }
  backgroundColor: string
  borderColor: string
}

export function FullCalendarWrapper() {
  const { data: paginatedOrders } = useOrders()
  const orders = paginatedOrders?.data || []
  const calendarRef = useRef<FullCalendar|null>(null)

  const events: FullCalendarEvent[] = orders.flatMap((order) => {
    if (!order.stages) return []
    
    return order.stages.map((stage: any) => ({
      title: `${order.name.substring(0, 20)}${order.name.length > 20 ? '...' : ''}`,
      start: stage.dateFrom,
      end: stage.dateTo,
      extendedProps: {
        order,
        status: order.status as keyof typeof STATUS_COLORS,
        clientName: order.client?.name || 'Brak danych',
        totalNet: order.totalNet
      },
      backgroundColor: STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || '#3b82f6',
      borderColor: STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || '#3b82f6'
    }))
  })

  // Automatically resize calendar when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (calendarRef.current) {
        calendarRef.current.getApi().updateSize()
      }
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="h-[calc(100vh-250px)] w-full">

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        events={events}
        eventContent={(eventInfo) => {
          const tooltipId = `tooltip-${eventInfo.event.id}`
          return (
            <>
              <div 
                className="p-1 truncate"
                data-tooltip-id={tooltipId}
                data-tooltip-content={`
                  ${eventInfo.event.title}\n
                  ${eventInfo.event.extendedProps.clientName}\n
                  Status: ${eventInfo.event.extendedProps.status}\n
                  ${eventInfo.event.extendedProps.totalNet.toFixed(2)} PLN\n
                  ${new Date(eventInfo.event.start!).toLocaleDateString('pl-PL')} - ${new Date(eventInfo.event.end!).toLocaleDateString('pl-PL')}
                `.trim()}
              >
                {eventInfo.event.title}
              </div>
              <Tooltip id={tooltipId} className="!max-w-[300px]" />
            </>
          )
        }}


        editable={false}
        selectable={false}
        weekends={true}
        dayMaxEvents={3}
        locale="pl"
        firstDay={1} // Monday as first day
      />
    </div>
  )
}