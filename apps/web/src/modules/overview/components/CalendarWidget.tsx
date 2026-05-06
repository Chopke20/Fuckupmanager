import { useEffect, useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useOrders, useDeleteOrder } from '../../orders/hooks/useOrders'
import { useEquipment } from '../../equipment/hooks/useEquipment'
import { api } from '../../../shared/api/client'
import type { Order, OrderStage } from '@lama-stage/shared-types'

type CalendarNoteEvent = {
  id: string
  title: string
  description?: string
  dateFrom: string
  dateTo: string
  allDay: boolean
}

const STAGE_LABELS = {
  MONTAZ: 'Montaż',
  EVENT: 'Wydarzenie',
  DEMONTAZ: 'Demontaż',
  PROBA: 'Próba',
  CUSTOM: 'Inny',
}

interface CalendarEvent {
  id: string
  title: string
  start: string
  end?: string
  allDay?: boolean
  backgroundColor?: string
  borderColor?: string
  classNames?: string[]
  extendedProps: {
    kind: 'order' | 'note' | 'block'
    orderId?: string
    orderName?: string
    stageType?: string
    stageId?: string
    stageLabel?: string
    clientName?: string
    noteId?: string
    blockId?: string
    equipmentId?: string
    quantity?: number
    dateFrom?: string
    dateTo?: string
    note?: string
  }
}

export default function CalendarWidget() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: paginatedOrders } = useOrders({ page: 1, limit: 500 })
  const { data: equipmentPaginated } = useEquipment({ page: 1, limit: 500 })
  const deleteOrderMutation = useDeleteOrder()

  const [eventMenu, setEventMenu] = useState<{ x: number; y: number; event: CalendarEvent } | null>(null)
  const [dayMenu, setDayMenu] = useState<{ x: number; y: number; date: string } | null>(null)
  const [reservationModal, setReservationModal] = useState<{ dateFrom: string; blockId?: string } | null>(null)
  const [noteModal, setNoteModal] = useState<{ dateFrom: string; event?: CalendarNoteEvent } | null>(null)
  const [reservationForm, setReservationForm] = useState({
    equipmentId: '',
    quantity: 1,
    dateFrom: '',
    dateTo: '',
    note: '',
  })
  const [noteForm, setNoteForm] = useState({
    title: '',
    description: '',
    dateFrom: '',
    dateTo: '',
  })
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [equipmentDropdownOpen, setEquipmentDropdownOpen] = useState(false)
  const [reservationError, setReservationError] = useState<string | null>(null)
  const [reservationAvailability, setReservationAvailability] = useState<{
    stockQuantity: number
    requestedQuantity: number
    minAvailable: number
    isAvailable: boolean
    conflictingOrders: Array<{ orderId: string; orderName: string; dateFrom: string; dateTo: string }>
    conflictingBlocks: Array<{ blockId: string; note: string | null; dateFrom: string; dateTo: string }>
  } | null>(null)
  const [isCheckingReservationAvailability, setIsCheckingReservationAvailability] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  const orders = paginatedOrders?.data ?? []
  const equipment = (equipmentPaginated?.data ?? []).filter((eq) => eq.category !== 'ZASOBY')
  const equipmentFiltered = useMemo(() => {
    if (!equipmentSearch.trim()) return equipment.slice(0, 50)
    const q = equipmentSearch.trim().toLowerCase()
    return equipment
      .filter((eq) => (eq.internalCode?.toLowerCase() || '').includes(q) || (eq.name?.toLowerCase() || '').includes(q))
      .slice(0, 50)
  }, [equipment, equipmentSearch])
  const selectedEquipment = equipment.find((eq) => eq.id === reservationForm.equipmentId)

  useEffect(() => {
    const equipmentId = reservationForm.equipmentId
    const dateFrom = reservationForm.dateFrom?.slice(0, 10)
    const dateTo = reservationForm.dateTo?.slice(0, 10)
    const qty = Number(reservationForm.quantity) || 1

    if (!equipmentId || !dateFrom || !dateTo) {
      setReservationAvailability(null)
      setIsCheckingReservationAvailability(false)
      return
    }

    const t = setTimeout(async () => {
      try {
        setIsCheckingReservationAvailability(true)
        const body = await api.post<{ success: boolean; data: any[] }>('/orders/availability', {
          equipmentIds: [equipmentId],
          dateFrom: new Date(`${dateFrom}T00:00:00`).toISOString(),
          dateTo: new Date(`${dateTo}T23:59:59`).toISOString(),
          excludeBlockId: reservationModal?.blockId,
          requests: [{ equipmentId, quantity: qty }],
        })
        const first = body?.data?.[0]
        if (!first) {
          setReservationAvailability(null)
          return
        }
        setReservationAvailability({
          stockQuantity: Number(first.stockQuantity) || 0,
          requestedQuantity: Number(first.requestedQuantity) || qty,
          minAvailable: Number(first.summary?.minAvailable) || 0,
          isAvailable: !!first.isAvailable,
          conflictingOrders: Array.isArray(first.conflictingOrders) ? first.conflictingOrders : [],
          conflictingBlocks: Array.isArray(first.conflictingBlocks) ? first.conflictingBlocks : [],
        })
      } catch {
        setReservationAvailability(null)
      } finally {
        setIsCheckingReservationAvailability(false)
      }
    }, 350)

    return () => clearTimeout(t)
  }, [reservationForm.equipmentId, reservationForm.dateFrom, reservationForm.dateTo, reservationForm.quantity])

  const { data: noteEventsData } = useQuery<{ data: CalendarNoteEvent[] }>({
    queryKey: ['calendar-note-events'],
    queryFn: () => api.get('/calendar-events'),
  })
  const { data: blocksData } = useQuery<any[]>({
    queryKey: ['calendar-blocks'],
    queryFn: () => api.get('/blocks'),
  })

  // Deep link: /?blockId=... otwiera rezerwację sprzętu
  useEffect(() => {
    const blockId = searchParams.get('blockId')
    if (!blockId) return
    const blocks = blocksData ?? []
    const block = blocks.find((b) => b?.id === blockId)
    if (!block) return

    const fromStr = new Date(block.dateFrom).toISOString().slice(0, 10)
    const toStr = new Date(block.dateTo).toISOString().slice(0, 10)
    setReservationModal({ dateFrom: fromStr, blockId: block.id })
    setReservationForm({
      equipmentId: block.equipmentId || '',
      quantity: block.quantity || 1,
      dateFrom: fromStr,
      dateTo: toStr,
      note: block.note || '',
    })
    setEquipmentSearch('')
    setReservationError(null)

    const next = new URLSearchParams(searchParams)
    next.delete('blockId')
    setSearchParams(next, { replace: true })
  }, [blocksData, searchParams, setSearchParams])

  const createBlockMutation = useMutation({
    mutationFn: (payload: { equipmentId: string; quantity: number; dateFrom: string; dateTo: string; note?: string }) =>
      api.post('/blocks', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-blocks'] }),
  })
  const updateBlockMutation = useMutation({
    mutationFn: (payload: { id: string; data: { equipmentId?: string; quantity?: number; dateFrom?: string; dateTo?: string; note?: string } }) =>
      api.put(`/blocks/${payload.id}`, payload.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-blocks'] }),
  })
  const deleteBlockMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/blocks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-blocks'] }),
  })
  const createNoteMutation = useMutation({
    mutationFn: (payload: { title: string; description?: string; dateFrom: string; dateTo: string; allDay: boolean }) =>
      api.post('/calendar-events', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-note-events'] }),
  })
  const updateNoteMutation = useMutation({
    mutationFn: (payload: { id: string; data: { title?: string; description?: string; dateFrom?: string; dateTo?: string; allDay?: boolean } }) =>
      api.put(`/calendar-events/${payload.id}`, payload.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-note-events'] }),
  })
  const deleteNoteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar-events/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-note-events'] }),
  })

  const getStatusColor = (status: string): { bg: string; classNames?: string[] } => {
    if (status === 'DRAFT') return { bg: '#94a3b8', classNames: ['opacity-70'] }
    if (status === 'OFFER_SENT') return { bg: '#64748b', classNames: ['opacity-60'] }
    if (status === 'CONFIRMED') return { bg: '#22c55e' }
    return { bg: '#3b82f6' } // COMPLETED
  }

  const calendarEvents = useMemo(() => {
    const allowed = new Set(['DRAFT', 'OFFER_SENT', 'CONFIRMED', 'COMPLETED'])
    const orderEvents = orders
      .filter((order) => allowed.has(order.status))
      .flatMap((order: Order) => {
        const style = getStatusColor(order.status)
        const stagesRaw = Array.isArray(order.stages) ? order.stages : []
        const stages = [...stagesRaw].sort(
          (a: OrderStage, b: OrderStage) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        )
        if (stages.length === 0) {
          return [{
            id: `order-${order.id}`,
            title: order.name,
            start: order.dateFrom ? new Date(order.dateFrom).toISOString() : new Date(order.startDate).toISOString(),
            end: order.dateTo ? new Date(order.dateTo).toISOString() : new Date(order.endDate).toISOString(),
            allDay: true,
            backgroundColor: style.bg,
            borderColor: style.bg,
            classNames: style.classNames,
            extendedProps: {
              kind: 'order' as const,
              orderId: order.id,
              orderName: order.name,
              clientName: order.client?.companyName,
            },
          }]
        }
        return stages.map((stage: OrderStage, idx: number) => {
          const stageDate = stage.date != null ? new Date(stage.date) : new Date()
          const startDate = new Date(stageDate)
          const endDate = new Date(stageDate)
          if (stage.timeStart) {
            const [h, m] = String(stage.timeStart).split(':').map(Number)
            startDate.setHours(h ?? 0, m ?? 0, 0, 0)
          }
          if (stage.timeEnd) {
            const [h, m] = String(stage.timeEnd).split(':').map(Number)
            endDate.setHours(h ?? 0, m ?? 0, 0, 0)
          } else {
            endDate.setHours(23, 59, 0, 0)
          }
          if (endDate.getTime() <= startDate.getTime()) {
            endDate.setTime(startDate.getTime() + 60 * 60 * 1000)
          }
          const stageLabel = stage.label || STAGE_LABELS[stage.type as keyof typeof STAGE_LABELS] || stage.type
          const eventId = `stage-${order.id}-${stage.id ?? `i-${idx}`}`
          return {
            id: eventId,
            title: order.name,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            allDay: !stage.timeStart && !stage.timeEnd,
            backgroundColor: style.bg,
            borderColor: style.bg,
            classNames: style.classNames,
            extendedProps: {
              kind: 'order' as const,
              orderId: order.id,
              orderName: order.name,
              stageType: stage.type,
              stageId: stage.id,
              stageLabel,
              clientName: order.client?.companyName,
            },
          }
        })
      })

    const noteEvents = (noteEventsData?.data ?? []).map((ev) => ({
      id: `note-${ev.id}`,
      title: ev.title,
      start: new Date(ev.dateFrom).toISOString(),
      end: new Date(ev.dateTo).toISOString(),
      allDay: ev.allDay,
      backgroundColor: '#8b5cf6',
      borderColor: '#8b5cf6',
      extendedProps: {
        kind: 'note' as const,
        noteId: ev.id,
      },
    }))

    const blockEvents = (blocksData ?? []).map((block) => ({
      id: `block-${block.id}`,
      title: `Rezerwacja: ${block.equipment?.name ?? 'Sprzęt'}`,
      start: new Date(block.dateFrom).toISOString(),
      end: new Date(block.dateTo).toISOString(),
      allDay: true,
      backgroundColor: '#f59e0b',
      borderColor: '#f59e0b',
      extendedProps: {
        kind: 'block' as const,
        blockId: block.id,
        equipmentId: block.equipmentId,
        quantity: block.quantity,
        dateFrom: block.dateFrom,
        dateTo: block.dateTo,
        note: block.note,
      },
    }))

    return [...orderEvents, ...noteEvents, ...blockEvents] as CalendarEvent[]
  }, [orders, noteEventsData, blocksData])

  const handleEventClick = (clickInfo: any) => {
    clickInfo.jsEvent.preventDefault()
    setDayMenu(null)
    setEventMenu({
      x: clickInfo.jsEvent.clientX,
      y: clickInfo.jsEvent.clientY,
      event: {
        id: clickInfo.event.id,
        title: clickInfo.event.title,
        start: clickInfo.event.startStr,
        end: clickInfo.event.endStr,
        allDay: clickInfo.event.allDay,
        backgroundColor: clickInfo.event.backgroundColor,
        borderColor: clickInfo.event.borderColor,
        classNames: clickInfo.event.classNames,
        extendedProps: clickInfo.event.extendedProps,
      },
    })
  }

  const handleDateClick = (clickInfo: any) => {
    setEventMenu(null)
    setDayMenu({
      x: clickInfo.jsEvent.clientX,
      y: clickInfo.jsEvent.clientY,
      date: clickInfo.dateStr,
    })
  }

  const closeMenus = () => {
    setEventMenu(null)
    setDayMenu(null)
  }

  const openReservationModal = (dateFrom: string, blockEvent?: CalendarEvent) => {
    const fromStr = dateFrom.slice(0, 10)
    const toStr = blockEvent?.extendedProps.dateTo ? new Date(blockEvent.extendedProps.dateTo).toISOString().slice(0, 10) : fromStr
    setReservationModal({ dateFrom: fromStr, blockId: blockEvent?.extendedProps.blockId })
    setReservationForm({
      equipmentId: blockEvent?.extendedProps.equipmentId || '',
      quantity: blockEvent?.extendedProps.quantity || 1,
      dateFrom: fromStr,
      dateTo: toStr,
      note: blockEvent?.extendedProps.note || '',
    })
    setEquipmentSearch('')
    setReservationError(null)
    closeMenus()
  }

  const openNoteModal = (dateFrom: string, note?: CalendarNoteEvent) => {
    setNoteModal({ dateFrom, event: note })
    const from = note?.dateFrom ? new Date(note.dateFrom).toISOString().slice(0, 10) : dateFrom.slice(0, 10)
    const to = note?.dateTo ? new Date(note.dateTo).toISOString().slice(0, 10) : dateFrom.slice(0, 10)
    setNoteForm({
      title: note?.title || '',
      description: note?.description || '',
      dateFrom: from,
      dateTo: to,
    })
    setNoteError(null)
    closeMenus()
  }

  const submitReservation = async () => {
    const dateFrom = reservationForm.dateFrom?.slice(0, 10)
    const dateTo = reservationForm.dateTo?.slice(0, 10)
    if (!reservationModal || !reservationForm.equipmentId || !dateFrom || !dateTo) {
      setReservationError('Wybierz sprzęt oraz daty Od i Do.')
      return
    }
    if (dateTo < dateFrom) {
      setReservationError('Data zakończenia nie może być wcześniejsza niż data początku.')
      return
    }
     const qty = Number(reservationForm.quantity) || 1
     if (selectedEquipment && qty > (selectedEquipment.stockQuantity ?? 0)) {
       setReservationError(`Na magazynie są ${selectedEquipment.stockQuantity ?? 0} szt., a próbujesz zarezerwować ${qty}.`)
       return
     }
    setReservationError(null)
    const payload = {
      equipmentId: reservationForm.equipmentId,
      quantity: qty,
      dateFrom: new Date(`${dateFrom}T00:00:00`).toISOString(),
      dateTo: new Date(`${dateTo}T23:59:59`).toISOString(),
      note: reservationForm.note || undefined,
    }
    try {
      if (reservationModal.blockId) {
        await updateBlockMutation.mutateAsync({ id: reservationModal.blockId, data: payload })
      } else {
        await createBlockMutation.mutateAsync(payload)
      }
      setReservationModal(null)
    } catch (err: any) {
      const apiError = err?.response?.data?.error
      if (apiError?.code === 'EQUIPMENT_UNAVAILABLE') {
        const details = apiError.details || {}
        const stock = details.stockQuantity ?? selectedEquipment?.stockQuantity
        const requested = details.requestedQuantity ?? qty
        const minAvailable = details.summary?.minAvailable
        const base = `Sprzęt jest niedostępny w wybranym terminie.`
        const counts =
          stock != null && minAvailable != null
            ? ` Stan magazynowy: ${stock} szt., minimalnie dostępne w tym okresie: ${minAvailable}, rezerwowana ilość: ${requested}.`
            : ''
        setReservationError(base + counts)
        return
      }
      const fallback = typeof apiError?.message === 'string' ? apiError.message : err?.message
      setReservationError(fallback || 'Nie udało się zapisać rezerwacji.')
    }
  }

  const submitNote = async () => {
    const dateFrom = (noteForm.dateFrom || noteModal?.dateFrom || '').slice(0, 10)
    const dateTo = noteForm.dateTo?.slice(0, 10)
    if (!noteModal || !noteForm.title || !dateFrom || !dateTo) {
      setNoteError('Wypełnij nazwę oraz daty początku i zakończenia.')
      return
    }
    setNoteError(null)
    const payload = {
      title: noteForm.title,
      description: noteForm.description || undefined,
      dateFrom: new Date(`${dateFrom}T00:00:00`).toISOString(),
      dateTo: new Date(`${dateTo}T23:59:59`).toISOString(),
      allDay: true,
    }
    try {
      if (noteModal.event) {
        await updateNoteMutation.mutateAsync({ id: noteModal.event.id, data: payload })
      } else {
        await createNoteMutation.mutateAsync(payload)
      }
      setNoteModal(null)
    } catch (err: any) {
      setNoteError(err?.response?.data?.error || err?.message || 'Nie udało się zapisać.')
    }
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-3 relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Kalendarz wydarzeń</h2>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#64748b]" />
            <span>Oferta wysłana</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
            <span>Potwierdzone</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
            <span>Zakończone</span>
          </div>
        </div>
      </div>

      <div className="h-[560px]">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={calendarEvents}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          editable={false}
          selectable={true}
          weekends={true}
          dayMaxEvents={4}
          height="100%"
          locale="pl"
          buttonText={{
            today: 'Dzisiaj',
            month: 'Miesiąc',
            week: 'Tydzień',
            day: 'Dzień',
          }}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
          }}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
          }}
          eventDisplay="block"
          eventClassNames="cursor-pointer rounded-sm"
          eventContent={(arg) => {
            const stageLabel = arg.event.extendedProps?.stageLabel
            if (stageLabel) {
              return (
                <div className="flex flex-col min-w-0 overflow-hidden py-0.5">
                  <span className="font-medium truncate" title={arg.event.title}>
                    {arg.event.title}
                  </span>
                  <span className="text-xs opacity-90 truncate">{stageLabel}</span>
                </div>
              )
            }
            return <span className="truncate" title={arg.event.title}>{arg.event.title}</span>
          }}
        />
      </div>

      {eventMenu && (
        <div className="fixed inset-0 z-40" onClick={closeMenus}>
          <div
            className="absolute bg-surface border border-border rounded-lg shadow-xl p-1.5 min-w-[170px]"
            style={{ left: eventMenu.x, top: eventMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 py-1.5 text-xs text-muted-foreground">{eventMenu.event.title}</div>
            <button
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-surface-2 rounded flex items-center gap-2"
              onClick={() => {
                const kind = eventMenu.event.extendedProps.kind
                if (kind === 'order') {
                  const orderId = eventMenu.event.extendedProps.orderId
                  if (!orderId) return
                  const withSchedule = !!eventMenu.event.extendedProps.stageId
                  navigate(withSchedule ? `/orders/${orderId}#schedule` : `/orders/${orderId}`)
                } else if (kind === 'note') {
                  const note = (noteEventsData?.data ?? []).find((n) => n.id === eventMenu.event.extendedProps.noteId)
                  if (note) openNoteModal(note.dateFrom.slice(0, 10), note)
                } else if (kind === 'block') {
                  openReservationModal((eventMenu.event.extendedProps.dateFrom || '').slice(0, 10), eventMenu.event)
                }
                closeMenus()
              }}
            >
              <Pencil size={14} /> Edytuj
            </button>
            <button
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-surface-2 rounded text-red-500 flex items-center gap-2"
              onClick={async () => {
                const kind = eventMenu.event.extendedProps.kind
                if (kind === 'order' && eventMenu.event.extendedProps.orderId) {
                  const ok = window.confirm('Czy na pewno chcesz usunąć to zlecenie? Zlecenie trafi do kosza.')
                  if (!ok) return
                  await deleteOrderMutation.mutateAsync(eventMenu.event.extendedProps.orderId)
                }
                if (kind === 'note' && eventMenu.event.extendedProps.noteId) {
                  const ok = window.confirm('Czy na pewno chcesz usunąć tę notatkę?')
                  if (!ok) return
                  await deleteNoteMutation.mutateAsync(eventMenu.event.extendedProps.noteId)
                }
                if (kind === 'block' && eventMenu.event.extendedProps.blockId) {
                  const ok = window.confirm('Czy na pewno chcesz usunąć tę rezerwację sprzętu?')
                  if (!ok) return
                  await deleteBlockMutation.mutateAsync(eventMenu.event.extendedProps.blockId)
                }
                closeMenus()
              }}
            >
              <Trash2 size={14} /> Usuń
            </button>
          </div>
        </div>
      )}

      {dayMenu && (
        <div className="fixed inset-0 z-40" onClick={closeMenus}>
          <div
            className="absolute bg-surface border border-border rounded-lg shadow-xl p-1.5 min-w-[220px]"
            style={{ left: dayMenu.x, top: dayMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 py-1.5 text-xs text-muted-foreground">{format(new Date(dayMenu.date), 'dd.MM.yyyy', { locale: pl })}</div>
            <button
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-surface-2 rounded flex items-center gap-2"
              onClick={() => navigate(`/orders/new?date=${dayMenu.date}`)}
            >
              <Plus size={14} /> Nowe zlecenie
            </button>
            <button
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-surface-2 rounded flex items-center gap-2"
              onClick={() => openReservationModal(dayMenu.date)}
            >
              <MoreHorizontal size={14} /> Rezerwacja sprzętu
            </button>
            <button
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-surface-2 rounded flex items-center gap-2"
              onClick={() => openNoteModal(dayMenu.date)}
            >
              <MoreHorizontal size={14} /> Inne
            </button>
          </div>
        </div>
      )}

      {reservationModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg w-full max-w-md p-4 space-y-3">
            <h3 className="text-base font-semibold">Rezerwacja sprzętu</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">Od</label>
                <input
                  type="date"
                  value={reservationForm.dateFrom}
                  onChange={(e) => setReservationForm((s) => ({ ...s, dateFrom: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">Do</label>
                <input
                  type="date"
                  value={reservationForm.dateTo}
                  min={reservationForm.dateFrom || reservationModal.dateFrom}
                  onChange={(e) => setReservationForm((s) => ({ ...s, dateTo: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-sm"
                />
              </div>
            </div>
            <div className="relative">
              <label className="text-xs text-muted-foreground block mb-0.5">Sprzęt (wpisz kod lub nazwę)</label>
              <input
                type="text"
                value={equipmentDropdownOpen ? equipmentSearch : (selectedEquipment ? `${selectedEquipment.internalCode || '—'} - ${selectedEquipment.name}` : '')}
                onChange={(e) => {
                  setEquipmentSearch(e.target.value)
                  setEquipmentDropdownOpen(true)
                  if (!e.target.value) setReservationForm((s) => ({ ...s, equipmentId: '' }))
                }}
                onFocus={() => setEquipmentDropdownOpen(true)}
                onBlur={() => setTimeout(() => setEquipmentDropdownOpen(false), 150)}
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-sm"
                placeholder="Szukaj sprzętu..."
              />
              {equipmentDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-0.5 max-h-48 overflow-auto bg-surface border border-border rounded shadow-lg z-10">
                  {equipmentFiltered.length === 0 ? (
                    <div className="px-2.5 py-2 text-sm text-muted-foreground">Brak wyników</div>
                  ) : (
                    equipmentFiltered.map((eq) => (
                      <button
                        key={eq.id}
                        type="button"
                        className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-surface-2 border-b border-border last:border-0"
                        onClick={() => {
                          setReservationForm((s) => ({ ...s, equipmentId: eq.id }))
                          setEquipmentSearch('')
                          setEquipmentDropdownOpen(false)
                        }}
                      >
                        {eq.internalCode || '—'} - {eq.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-0.5">Ilość</label>
              <input
                type="number"
                min={1}
                value={reservationForm.quantity}
                onChange={(e) => setReservationForm((s) => ({ ...s, quantity: Number(e.target.value) || 1 }))}
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-sm"
              />
            </div>
            <input
              type="text"
              value={reservationForm.note}
              onChange={(e) => setReservationForm((s) => ({ ...s, note: e.target.value }))}
              className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-sm"
              placeholder="Notatka (opcjonalnie)"
            />
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
              {isCheckingReservationAvailability ? (
                <span className="text-muted-foreground">Sprawdzanie dostępności…</span>
              ) : reservationAvailability ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded border border-border bg-background px-2 py-1.5">
                      <div className="text-[10px] text-muted-foreground uppercase">Stan</div>
                      <div className="font-semibold">{reservationAvailability.stockQuantity}</div>
                    </div>
                    <div className="rounded border border-border bg-background px-2 py-1.5">
                      <div className="text-[10px] text-muted-foreground uppercase">Potrzeba</div>
                      <div className="font-semibold">{reservationAvailability.requestedQuantity}</div>
                    </div>
                    <div className="rounded border border-border bg-background px-2 py-1.5">
                      <div className="text-[10px] text-muted-foreground uppercase">Min. dostępne</div>
                      <div className={`font-semibold ${reservationAvailability.minAvailable >= reservationAvailability.requestedQuantity ? 'text-green-500' : 'text-red-500'}`}>
                        {reservationAvailability.minAvailable}
                      </div>
                    </div>
                  </div>

                  {reservationAvailability.isAvailable ? (
                    <div className="rounded border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-200">
                      Sprzęt jest dostępny w podanym terminie dla zadanej ilości.
                    </div>
                  ) : (
                    <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                      Sprzęt jest niedostępny w podanym terminie dla zadanej ilości.
                    </div>
                  )}

                  {!reservationAvailability.isAvailable && (
                    <div className="space-y-2">
                      {(reservationAvailability.conflictingOrders?.length > 0) && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Zlecenia</div>
                          {reservationAvailability.conflictingOrders.map((o) => (
                            <a
                              key={o.orderId}
                              href={`/orders/${o.orderId}`}
                              className="block text-sm border border-border rounded px-3 py-2 hover:bg-background"
                            >
                              <div className="font-medium">{o.orderName}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(o.dateFrom).toLocaleDateString()} – {new Date(o.dateTo).toLocaleDateString()}
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                      {(reservationAvailability.conflictingBlocks?.length > 0) && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Wynajem / blokady (kalendarz)</div>
                          {reservationAvailability.conflictingBlocks.map((b) => (
                            <div key={b.blockId} className="text-sm border border-border rounded px-3 py-2 bg-background">
                              <div className="font-medium">{b.note || 'Blokada sprzętu'}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(b.dateFrom).toLocaleDateString()} – {new Date(b.dateTo).toLocaleDateString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">Wybierz sprzęt, daty i ilość, aby zobaczyć dostępność.</span>
              )}
            </div>
            {reservationError && <p className="text-sm text-red-500">{reservationError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-1.5 border border-border rounded text-sm" onClick={() => setReservationModal(null)}>Anuluj</button>
              <button type="button" className="px-3 py-1.5 border-2 border-primary text-primary rounded text-sm" onClick={submitReservation}>Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {noteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg w-full max-w-md p-4 space-y-3">
            <h3 className="text-base font-semibold">Inne wydarzenie (może trwać kilka dni)</h3>
            <input
              type="text"
              value={noteForm.title}
              onChange={(e) => setNoteForm((s) => ({ ...s, title: e.target.value }))}
              className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-sm"
              placeholder="Nazwa wydarzenia"
            />
            <textarea
              value={noteForm.description}
              onChange={(e) => setNoteForm((s) => ({ ...s, description: e.target.value }))}
              className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-sm"
              rows={3}
              placeholder="Opis"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">Od</label>
                <input
                  type="date"
                  value={noteForm.dateFrom}
                  onChange={(e) => setNoteForm((s) => ({ ...s, dateFrom: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">Do</label>
                <input
                  type="date"
                  value={noteForm.dateTo}
                  min={noteForm.dateFrom || noteModal.dateFrom}
                  onChange={(e) => setNoteForm((s) => ({ ...s, dateTo: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-sm"
                />
              </div>
            </div>
            {noteError && <p className="text-sm text-red-500">{noteError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-1.5 border border-border rounded text-sm" onClick={() => setNoteModal(null)}>Anuluj</button>
              <button type="button" className="px-3 py-1.5 border-2 border-primary text-primary rounded text-sm" onClick={submitNote}>Zapisz</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}