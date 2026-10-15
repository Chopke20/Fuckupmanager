import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { Paperclip, X } from 'lucide-react'
import { orderApi } from '../../orders/api/order.api'
import { formatOrderNumber } from '../../orders/utils/orderNumberFormat'

type OrderHit = {
  id: string
  name: string
  orderNumber?: number | null
  orderYear?: number | null
  client?: { companyName?: string | null } | null
}

function buildOrderLabel(order: OrderHit): string {
  const num = formatOrderNumber(order.orderNumber, order.orderYear)
  const name = (order.name || '').trim() || 'Zlecenie'
  return num !== '—' ? `${num} · ${name}`.slice(0, 120) : name.slice(0, 120)
}

export default function PlannerSectionOrderAttach({
  orderId,
  orderLabel,
  onAttach,
  onDetach,
  variant = 'light',
  compact = false,
  readOnly = false,
}: {
  orderId?: string
  orderLabel?: string
  onAttach: (orderId: string, orderLabel: string) => void
  onDetach: () => void
  variant?: 'light' | 'dark'
  compact?: boolean
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<OrderHit[]>([])
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
        setHits([])
      }
    }
    document.addEventListener('pointerdown', onDoc, true)
    return () => document.removeEventListener('pointerdown', onDoc, true)
  }, [open])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 1) {
      setHits([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const t = window.setTimeout(() => {
      void orderApi
        .getAll({ search: q, page: 1, limit: 10 })
        .then((res) => {
          if (cancelled) return
          setHits((res.data ?? []) as OrderHit[])
        })
        .catch(() => {
          if (!cancelled) setHits([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [open, query])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const stop = (e: ReactPointerEvent) => e.stopPropagation()

  const dark = variant === 'dark'
  const chipClass = dark
    ? 'bg-black/40 text-white/95 hover:bg-black/55'
    : 'bg-surface border border-border text-foreground hover:border-primary/40'
  const btnClass = dark
    ? 'bg-black/35 text-white/90 hover:bg-black/50'
    : 'border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
  const panelClass = dark
    ? 'border-white/20 bg-zinc-900 text-white shadow-xl'
    : 'border-border bg-background text-foreground shadow-lg'
  const hitClass = dark ? 'hover:bg-white/10' : 'hover:bg-surface'

  if (orderId) {
    const label = orderLabel?.trim() || 'Zlecenie'
    return (
      <div
        className={`mt-1 flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 ${chipClass} ${
          compact ? 'text-[9px]' : 'text-[10px]'
        }`}
        onPointerDown={stop}
      >
        <Paperclip size={compact ? 9 : 11} className="shrink-0 opacity-80" />
        <Link
          to={`/orders/${orderId}`}
          className="min-w-0 truncate underline-offset-2 hover:underline"
          title={label}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={stop}
        >
          {label}
        </Link>
        {!readOnly ? (
          <button
            type="button"
            className="shrink-0 opacity-70 hover:opacity-100"
            aria-label="Odepnij zlecenie"
            title="Odepnij zlecenie"
            onClick={(e) => {
              e.stopPropagation()
              onDetach()
            }}
            onPointerDown={stop}
          >
            <X size={compact ? 9 : 11} />
          </button>
        ) : null}
      </div>
    )
  }

  if (readOnly) return null

  return (
    <div ref={rootRef} className="relative mt-1" onPointerDown={stop}>
      {!open ? (
        <button
          type="button"
          className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 ${btnClass} ${
            compact ? 'text-[9px]' : 'text-[10px]'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
          onPointerDown={stop}
        >
          <Paperclip size={compact ? 9 : 11} /> zlecenie
        </button>
      ) : (
        <div className={`absolute left-0 z-40 mt-0.5 w-[min(280px,70vw)] rounded border p-1.5 ${panelClass}`}>
          <input
            ref={inputRef}
            className={`w-full rounded border px-1.5 py-1 text-[11px] outline-none ${
              dark
                ? 'border-white/20 bg-black/40 text-white placeholder:text-white/40'
                : 'border-border bg-surface'
            }`}
            placeholder="Szukaj zlecenia…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onPointerDown={stop}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false)
                setQuery('')
                setHits([])
              }
            }}
          />
          <div className="mt-1 max-h-40 overflow-auto">
            {loading ? (
              <div className="px-1 py-1 text-[10px] opacity-60">Szukam…</div>
            ) : query.trim() && hits.length === 0 ? (
              <div className="px-1 py-1 text-[10px] opacity-60">Brak wyników</div>
            ) : (
              hits.map((hit) => {
                const label = buildOrderLabel(hit)
                const client = hit.client?.companyName?.trim()
                return (
                  <button
                    key={hit.id}
                    type="button"
                    className={`flex w-full flex-col items-start rounded px-1.5 py-1 text-left ${hitClass}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onAttach(hit.id, label)
                      setOpen(false)
                      setQuery('')
                      setHits([])
                    }}
                    onPointerDown={stop}
                  >
                    <span className="truncate text-[11px] font-medium">{label}</span>
                    {client ? <span className="truncate text-[9px] opacity-60">{client}</span> : null}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
