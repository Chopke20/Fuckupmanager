import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, Eye } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useOrder } from '../hooks/useOrders'
import { formatOrderNumber } from '../utils/orderNumberFormat'
import {
  parseStagePlanSetJson,
  renderStagePlanSvg,
  type StagePlan,
} from '@lama-stage/shared-types'
import { downloadOrderStagePlanPdf, getOrderStagePlanPdfPreviewUrl } from '../api/order.api'
import {
  describePlanScope,
  PlanScopeControls,
  type PlanDocScope,
} from '../components/OrderPlanDocumentScope'

interface StagePlanOption {
  id: string
  label: string
  groupLabel: string
  plan: StagePlan
  blockId: string | null
  sceneId: string
}

export default function OrderStagePlanPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: order, isLoading, isError } = useOrder(id || '')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scope, setScope] = useState<PlanDocScope>('order')
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')

  const planOptions = useMemo((): StagePlanOption[] => {
    if (!order) return []
    const options: StagePlanOption[] = []
    const pushSet = (raw: string | null | undefined, blockId: string | null, groupLabel: string) => {
      const set = parseStagePlanSetJson(raw)
      for (const scene of set.scenes) {
        options.push({
          id: `${blockId ?? 'order'}::${scene.id}`,
          label: scene.name,
          groupLabel,
          plan: scene.plan,
          blockId,
          sceneId: scene.id,
        })
      }
    }
    if (order.stagePlanJson) {
      pushSet(order.stagePlanJson, null, 'Plan zlecenia (główny wykaz)')
    }
    for (const block of order.offerBlocks ?? []) {
      if (block.stagePlanJson) {
        pushSet(block.stagePlanJson, block.id, `Blok: ${block.title}`)
      }
    }
    return options
  }, [order])

  useEffect(() => {
    if (planOptions.length === 0) {
      setSelectedPlanId('')
      return
    }
    if (!planOptions.some((option) => option.id === selectedPlanId)) {
      setSelectedPlanId(planOptions[0]!.id)
    }
  }, [planOptions, selectedPlanId])

  const selectedOption = planOptions.find((option) => option.id === selectedPlanId) ?? null
  const plan = selectedOption?.plan ?? null
  const svg = plan ? renderStagePlanSvg(plan, { theme: 'dark' }) : ''

  const groupCount = useMemo(() => {
    const labels = new Set(planOptions.map((o) => o.groupLabel))
    return labels.size
  }, [planOptions])

  const scopeBlockId =
    scope === 'order' ? null : selectedOption?.blockId ?? null
  const scopeSceneId = scope === 'item' ? selectedOption?.sceneId ?? null : null
  const apiScope = scope === 'item' ? 'scene' : scope

  const previewUrl =
    id && (scope === 'order' || selectedOption)
      ? getOrderStagePlanPdfPreviewUrl(id, {
          scope: apiScope,
          blockId: scopeBlockId,
          sceneId: scopeSceneId,
        })
      : ''

  const ctaLabel = describePlanScope({
    scope,
    itemCount: planOptions.length,
    groupCount,
    selectedLabel:
      scope === 'block'
        ? selectedOption?.groupLabel
        : scope === 'item'
          ? selectedOption
            ? `${selectedOption.groupLabel} · ${selectedOption.label}`
            : null
          : null,
    itemNounPlural: 'scen',
  })

  const orderNumberDisplay = useMemo(() => {
    if (!order) return '—'
    const o = order as { orderNumber?: number | null; orderYear?: number | null }
    return o.orderNumber != null && o.orderYear != null
      ? formatOrderNumber(o.orderNumber, o.orderYear)
      : '—'
  }, [order])

  const eventDateDisplay = useMemo(() => {
    if (!order?.dateFrom) return null
    const fmt = (value: string) =>
      new Date(value).toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    const from = fmt(order.dateFrom)
    const to = order.dateTo ? fmt(order.dateTo) : null
    if (to && to !== from) return `${from} – ${to}`
    return from
  }, [order])

  useEffect(() => {
    setError(null)
  }, [id, selectedPlanId, scope])

  const handleDownload = async () => {
    if (!id) return
    if (scope !== 'order' && !selectedOption) return
    setPdfLoading(true)
    setError(null)
    try {
      await downloadOrderStagePlanPdf(id, {
        scope: apiScope,
        blockId: scopeBlockId,
        sceneId: scopeSceneId,
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
            disabled={pdfLoading || planOptions.length === 0 || (scope !== 'order' && !plan)}
            title={
              planOptions.length === 0
                ? 'Brak złożonej sceny w zapisanym zleceniu'
                : `Pobierz PDF — ${ctaLabel}`
            }
            className="inline-flex items-center gap-1.5 rounded border-2 border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} />
            {pdfLoading ? 'Generowanie PDF…' : 'Pobierz PDF'}
          </button>
          {planOptions.length > 0 && previewUrl ? (
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
            selectedItemId={selectedPlanId}
            onSelectItem={setSelectedPlanId}
            items={planOptions}
            itemNoun="Scena"
          />
        </aside>

        <div className="rounded-xl border border-border bg-surface">
          <div className="flex justify-between border-b border-border bg-surface-2 px-4 py-2 text-sm">
            <span>
              Zlecenie: <strong className="font-mono">{orderNumberDisplay}</strong>
            </span>
            <span>Plan sceny</span>
          </div>
          <div className="space-y-4 p-4">
            <h1 className="text-lg font-bold">Plan sceny — rzut z góry</h1>
            {eventDateDisplay ? (
              <p className="text-base font-semibold text-foreground">
                Data wydarzenia:{' '}
                <span className="font-normal tabular-nums text-muted-foreground">
                  {eventDateDisplay}
                </span>
              </p>
            ) : null}

            {planOptions.length === 0 ? (
              <div className="space-y-3 rounded border border-border bg-background/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Brak złożonej sceny w <strong>zapisanym</strong> zleceniu. Jeśli właśnie dodałeś
                  scenę w formularzu — wróć i użyj przycisku „Plan sceny” w Dokumentach (zapisze
                  zmiany), albo zapisz zlecenie ręcznie.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/orders/${id}`)}
                  className="rounded border-2 border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  Wróć do zlecenia
                </button>
              </div>
            ) : !plan ? (
              <p className="text-sm text-muted-foreground">Wybierz scenę do podglądu.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Podgląd: {selectedOption?.groupLabel} · {selectedOption?.label}. Zakres PDF:{' '}
                  {ctaLabel}.
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
