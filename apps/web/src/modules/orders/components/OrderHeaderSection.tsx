import { useState, useEffect, useRef } from 'react'
import { useFormContext } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { Order } from '@lama-stage/shared-types'
import { useClients } from '../../clients/hooks/useClients'
import { dateInputToISO, isoToDateInput, isValidDateInput } from '../../../shared/utils/dateHelpers'
import { api } from '../../../shared/api/client'
import { orderApi } from '../api/order.api'
import ClientFormModal from '../../clients/components/ClientFormModal'
import { formatOrderNumber } from '../utils/orderNumberFormat'

interface OrderHeaderSectionProps {
  /** Przy tworzeniu nowego zlecenia blokujemy daty w przeszłości */
  isNewOrder?: boolean
  onChange?: (data: Partial<Order>) => void
}

export default function OrderHeaderSection({ isNewOrder, onChange }: OrderHeaderSectionProps) {
  const { watch } = useFormContext<Partial<Order>>()
  const queryClient = useQueryClient()
  const { data: paginatedClients } = useClients()
  const clients = paginatedClients?.data || []
  const [showNewClient, setShowNewClient] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [venueSuggestions, setVenueSuggestions] = useState<Array<{ placeId: string; description: string; mapsUrl: string }>>([])
  const [isVenueLoading, setIsVenueLoading] = useState(false)
  const [showVenueSuggestions, setShowVenueSuggestions] = useState(false)
  const [localDateFrom, setLocalDateFrom] = useState('')
  const [localDateTo, setLocalDateTo] = useState('')
  const dateFromFocused = useRef(false)
  const dateToFocused = useRef(false)

  const order = watch()

  const todayYMD = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  useEffect(() => {
    if (!dateFromFocused.current) {
      setLocalDateFrom(order?.dateFrom ? isoToDateInput(order.dateFrom) : '')
    }
  }, [order?.dateFrom])
  useEffect(() => {
    if (!dateToFocused.current) {
      setLocalDateTo(order?.dateTo ? isoToDateInput(order.dateTo) : '')
    }
  }, [order?.dateTo])
  useEffect(() => {
    const query = (order?.venue || '').trim()
    if (query.length < 2) {
      setVenueSuggestions([])
      setIsVenueLoading(false)
      return
    }
    const timeout = setTimeout(async () => {
      try {
        setIsVenueLoading(true)
        const response = await api.get<{ data: Array<{ placeId: string; description: string; mapsUrl: string }> }>(
          '/places/autocomplete',
          { query }
        )
        setVenueSuggestions(response.data ?? [])
      } catch {
        setVenueSuggestions([])
      } finally {
        setIsVenueLoading(false)
      }
    }, 250)
    return () => clearTimeout(timeout)
  }, [order?.venue])

  const statusOptions = [
    { value: 'DRAFT', label: 'Szkic' },
    { value: 'OFFER_SENT', label: 'Oferta wysłana' },
    { value: 'CONFIRMED', label: 'Potwierdzone' },
    { value: 'COMPLETED', label: 'Zakończone' },
    { value: 'CANCELLED', label: 'Anulowane' },
  ]

  const handleChange = (field: keyof Order, value: any) => {
    onChange?.({ [field]: value })
  }

  const handleUpdates = (updates: Partial<Order>) => {
    onChange?.(updates)
  }

  const rewriteDescriptionWithAi = async (retry = false) => {
    const rawText = (order?.description || '').trim()
    if (!rawText) {
      setAiError('Wpisz lub wklej tekst do pola opisu.')
      return
    }
    setAiError(null)
    setIsAiLoading(true)
    try {
      const response = await orderApi.rewriteDescription({
        rawText,
        name: order?.name || undefined,
        venue: order?.venue || undefined,
        status: order?.status || undefined,
        retry,
      })
      handleChange('description', response.description)
    } catch {
      setAiError('Nie udało się zredagować opisu AI.')
    } finally {
      setIsAiLoading(false)
    }
  }

  const orderNumber = (order?.orderNumber ?? (order as any)?.orderNumber) as number | undefined
  const orderYear = (order?.orderYear ?? (order as any)?.orderYear) as number | undefined
  const orderNumberDisplay = formatOrderNumber(orderNumber, orderYear)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold mb-3">Nagłówek zlecenia</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Numer zlecenia</label>
            <div className="px-3 py-2 text-sm bg-surface-2 border border-border rounded font-mono text-primary min-h-[2.5rem] flex items-center">
              {orderNumberDisplay}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {orderNumberDisplay !== '—'
                ? 'Numer nadany przy tworzeniu (tylko do odczytu).'
                : 'Numer w formacie ORD-YY-NNNN zostanie nadany po zapisaniu zlecenia.'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Nazwa zlecenia *
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded"
              value={order?.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Np. Event konferencyjny XYZ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Status
            </label>
            <select
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded"
              value={order?.status || 'DRAFT'}
              onChange={(e) => handleChange('status', e.target.value)}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Opis wewnętrzny (techniczny)
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Na potrzeby zespołu i koordynacji — nie pokazujemy go klientowi w ofercie. Tekst do PDF dla klienta
              ustawiasz na stronie Oferta.
            </p>
            <div className="flex items-center gap-2 mb-1">
              <button
                type="button"
                onClick={() => rewriteDescriptionWithAi(false)}
                disabled={isAiLoading || !order?.description?.trim()}
                className="px-2.5 py-1 text-xs border border-border rounded hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                {isAiLoading ? 'Redagowanie...' : 'AI: Zredaguj'}
              </button>
              <button
                type="button"
                onClick={() => rewriteDescriptionWithAi(true)}
                disabled={isAiLoading || !order?.description?.trim()}
                className="px-2.5 py-1 text-xs border border-border rounded hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                Odśwież
              </button>
            </div>
            <textarea
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded min-h-[80px]"
              value={order?.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Opis techniczny / wewnętrzny dla firmy (brief, logistyka)…"
            />
            {aiError && <p className="text-xs text-red-500 mt-1">{aiError}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Klient *</label>
            <div className="flex gap-2">
              <select
                className="min-w-0 flex-1 px-3 py-2 text-sm bg-background border border-border rounded"
                value={order?.clientId || ''}
                onChange={(e) => handleChange('clientId', e.target.value)}
              >
                <option value="">Wybierz klienta...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.companyName} {client.contactName ? ` (${client.contactName})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewClient(true)}
                className="shrink-0 px-3 py-2 text-sm border-2 border-primary text-primary bg-transparent rounded hover:bg-primary/10 transition-colors"
              >
                + Nowy
              </button>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Miejsce realizacji</label>
            <div className="relative">
              <input
                type="text"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded"
                value={order?.venue || ''}
                onFocus={() => setShowVenueSuggestions(true)}
                onBlur={() => setTimeout(() => setShowVenueSuggestions(false), 120)}
                onChange={(e) => {
                  handleUpdates({ venue: e.target.value, venuePlaceId: undefined })
                  setShowVenueSuggestions(true)
                }}
                placeholder="Np. Centrum Konferencyjne XYZ, Warszawa"
              />
              {showVenueSuggestions && ((order?.venue || '').trim().length >= 2 || isVenueLoading) && (
                <div className="absolute z-20 mt-1 w-full rounded border border-border bg-surface shadow-lg max-h-56 overflow-auto">
                  {isVenueLoading ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Szukam miejsc...</div>
                  ) : venueSuggestions.length > 0 ? (
                    venueSuggestions.map((s) => (
                      <button
                        key={s.placeId}
                        type="button"
                        onClick={() => {
                          handleUpdates({ venue: s.description, venuePlaceId: s.placeId })
                          setShowVenueSuggestions(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2"
                        title={s.description}
                      >
                        {s.description}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Brak podpowiedzi. Możesz wpisać miejsce ręcznie.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Data rozpoczęcia *
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded"
              min={isNewOrder ? todayYMD : undefined}
              value={localDateFrom}
              onFocus={() => { dateFromFocused.current = true }}
              onBlur={() => {
                dateFromFocused.current = false
                if (localDateFrom && isValidDateInput(localDateFrom)) {
                  const iso = dateInputToISO(localDateFrom)
                  if (iso) handleChange('dateFrom', iso)
                } else if (order?.dateFrom) {
                  setLocalDateFrom(isoToDateInput(order.dateFrom))
                }
              }}
              onChange={(e) => {
                const v = e.target.value
                setLocalDateFrom(v)
                if (isValidDateInput(v)) {
                  const iso = dateInputToISO(v)
                  if (iso) handleChange('dateFrom', iso)
                }
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Data zakończenia *
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded"
              min={localDateFrom || todayYMD}
              value={localDateTo}
              onFocus={() => { dateToFocused.current = true }}
              onBlur={() => {
                dateToFocused.current = false
                if (localDateTo && isValidDateInput(localDateTo)) {
                  const iso = dateInputToISO(localDateTo)
                  if (iso) handleChange('dateTo', iso)
                } else if (order?.dateTo) {
                  setLocalDateTo(isoToDateInput(order.dateTo))
                }
              }}
              onChange={(e) => {
                const v = e.target.value
                setLocalDateTo(v)
                if (isValidDateInput(v)) {
                  const iso = dateInputToISO(v)
                  if (iso) handleChange('dateTo', iso)
                }
              }}
            />
          </div>
        </div>
      </div>

      <ClientFormModal
        isOpen={showNewClient}
        onClose={() => setShowNewClient(false)}
        client={null}
        onSuccess={async (created) => {
          await queryClient.refetchQueries({ queryKey: ['clients'] })
          handleChange('clientId', created.id)
          setShowNewClient(false)
        }}
      />
    </div>
  )
}