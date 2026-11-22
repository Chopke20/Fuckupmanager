import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, Eye, Monitor } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  parseLedScreenSetJson,
  renderLedScreenSvg,
  type LedScreenProjectPayload,
} from '@lama-stage/shared-types'
import { useOrder } from '../hooks/useOrders'
import { formatOrderNumber } from '../utils/orderNumberFormat'
import { downloadOrderLedPlanPdf, getOrderLedPlanPdfPreviewUrl } from '../api/order.api'
import {
  describePlanScope,
  PlanScopeControls,
  type PlanDocScope,
} from '../components/OrderPlanDocumentScope'

interface LedPlanOption {
  id: string
  label: string
  groupLabel: string
  project: LedScreenProjectPayload
  blockId: string | null
  entryId: string
}

export default function OrderLedPlanPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: order, isLoading, isError } = useOrder(id || '')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scope, setScope] = useState<PlanDocScope>('order')
  const [selectedId, setSelectedId] = useState('')

  const options = useMemo((): LedPlanOption[] => {
    if (!order) return []
    const list: LedPlanOption[] = []
    const pushSet = (raw: string | null | undefined, blockId: string | null, groupLabel: string) => {
      const set = parseLedScreenSetJson(raw)
      for (const entry of set.entries) {
        list.push({
          id: `${blockId ?? 'order'}::${entry.id}`,
          label: entry.name,
          groupLabel,
          project: entry.project,
          blockId,
          entryId: entry.id,
        })
      }
    }
    pushSet(
      (order as { ledScreenJson?: string | null }).ledScreenJson,
      null,
      'Plan zlecenia (główny wykaz)'
    )
    for (const block of order.offerBlocks ?? []) {
      pushSet(
        (block as { ledScreenJson?: string | null }).ledScreenJson,
        block.id,
        `Blok: ${block.title}`
      )
    }
    return list
  }, [order])

  useEffect(() => {
    if (options.length === 0) {
      setSelectedId('')
      return
    }
    if (!options.some((o) => o.id === selectedId)) {
      setSelectedId(options[0]!.id)
    }
  }, [options, selectedId])

  const selected = options.find((o) => o.id === selectedId) ?? null
  const svg = selected
    ? renderLedScreenSvg(selected.project, { theme: 'dark', widthPx: 720 })
    : ''

  const groupCount = useMemo(() => new Set(options.map((o) => o.groupLabel)).size, [options])
  const scopeBlockId = scope === 'order' ? null : selected?.blockId ?? null
  const scopeEntryId = scope === 'item' ? selected?.entryId ?? null : null
  const apiScope = scope === 'item' ? 'entry' : scope

  const previewUrl =
    id && (scope === 'order' || selected)
      ? getOrderLedPlanPdfPreviewUrl(id, {
          scope: apiScope,
          blockId: scopeBlockId,
          entryId: scopeEntryId,
        })
      : ''

  const ctaLabel = describePlanScope({
    scope,
    itemCount: options.length,
    groupCount,
    selectedLabel:
      scope === 'block'
        ? selected?.groupLabel
        : scope === 'item'
          ? selected
            ? `${selected.groupLabel} · ${selected.label}`
            : null
          : null,
    itemNounPlural: 'ekranów',
  })

  const orderNumberDisplay = useMemo(() => {
    if (!order) return '—'
    const o = order as { orderNumber?: number | null; orderYear?: number | null }
    return o.orderNumber != null && o.orderYear != null
      ? formatOrderNumber(o.orderNumber, o.orderYear)
      : '—'
  }, [order])

  const handleDownload = async () => {
    if (!id) return
    if (scope !== 'order' && !selected) return
    setPdfLoading(true)
    setError(null)
    try {
      await downloadOrderLedPlanPdf(id, {
        scope: apiScope,
        blockId: scopeBlockId,
        entryId: scopeEntryId,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się pobrać PDF.')
    } finally {
      setPdfLoading(false)
    }
  }

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Ładowanie…</div>
  if (isError || !order) {
    return <div className="p-4 text-sm text-red-400">Nie znaleziono zlecenia.</div>
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(`/orders/${id}`)}
          className="flex w-fit items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={20} />
          Powrót do zlecenia
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground">PDF: {ctaLabel}</span>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={pdfLoading || options.length === 0 || (scope !== 'order' && !selected)}
            title={
              options.length === 0
                ? 'Brak ekranu LED w zapisanym zleceniu'
                : `Pobierz PDF — ${ctaLabel}`
            }
            className="inline-flex items-center gap-1.5 rounded border-2 border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} />
            {pdfLoading ? 'Generowanie PDF…' : 'Pobierz PDF'}
          </button>
          {options.length > 0 && previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
            >
              <Eye size={16} />
              Podgląd PDF
            </a>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </div>
      ) : null}

      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-border bg-surface p-3">
          <PlanScopeControls
            scope={scope}
            onScopeChange={setScope}
            selectedItemId={selectedId}
            onSelectItem={setSelectedId}
            items={options}
            itemNoun="Ekran"
          />
        </aside>

        <div className="rounded-xl border border-border bg-surface">
          <div className="flex justify-between border-b border-border bg-surface-2 px-4 py-2 text-sm">
            <span>
              Zlecenie: <strong className="font-mono">{orderNumberDisplay}</strong>
            </span>
            <span className="inline-flex items-center gap-1">
              <Monitor size={14} /> Plan LED
            </span>
          </div>
          <div className="space-y-4 p-4">
            <h1 className="text-lg font-bold">Plan LED — rzut ekranów</h1>

            {options.length === 0 ? (
              <div className="space-y-3 rounded border border-border bg-background/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Brak ekranu LED w <strong>zapisanym</strong> zleceniu. Jeśli właśnie dodałeś LED w
                  formularzu — wróć i użyj przycisku „Plan LED” w Dokumentach albo zapisz zlecenie.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/orders/${id}`)}
                  className="rounded border-2 border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  Wróć do zlecenia
                </button>
              </div>
            ) : !selected ? (
              <p className="text-sm text-muted-foreground">Wybierz ekran do podglądu.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Podgląd: {selected.groupLabel} · {selected.label}. Zakres PDF: {ctaLabel}.
                </p>
                <div
                  className="overflow-x-auto rounded border border-border bg-background p-2"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
