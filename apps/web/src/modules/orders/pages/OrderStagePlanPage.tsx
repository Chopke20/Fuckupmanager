import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, Eye } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useOrder } from '../hooks/useOrders'
import { formatOrderNumber } from '../utils/orderNumberFormat'
import { formatMeters, parseStagePlanJson, renderStagePlanSvg } from '@lama-stage/shared-types'
import { downloadOrderStagePlanPdf, getOrderStagePlanPdfPreviewUrl } from '../api/order.api'

interface StagePlanOption {
  id: string
  label: string
  planJson: string
  blockId: string | null
}

export default function OrderStagePlanPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: order, isLoading, isError } = useOrder(id || '')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')

  const planOptions = useMemo((): StagePlanOption[] => {
    if (!order) return []
    const options: StagePlanOption[] = []
    if (order.stagePlanJson) {
      options.push({
        id: 'order',
        label: 'Plan zlecenia (główny wykaz)',
        planJson: order.stagePlanJson,
        blockId: null,
      })
    }
    for (const block of order.offerBlocks ?? []) {
      if (block.stagePlanJson) {
        options.push({
          id: block.id,
          label: `Blok: ${block.title}`,
          planJson: block.stagePlanJson,
          blockId: block.id,
        })
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
  const plan = useMemo(
    () => parseStagePlanJson(selectedOption?.planJson ?? null),
    [selectedOption?.planJson]
  )
  const svg = plan ? renderStagePlanSvg(plan, { theme: 'dark' }) : ''
  const previewUrl =
    id && selectedOption
      ? getOrderStagePlanPdfPreviewUrl(id, selectedOption.blockId)
      : ''

  const orderNumberDisplay = useMemo(() => {
    if (!order) return '—'
    const o = order as { orderNumber?: number | null; orderYear?: number | null }
    return o.orderNumber != null && o.orderYear != null ? formatOrderNumber(o.orderNumber, o.orderYear) : '—'
  }, [order])

  useEffect(() => {
    setError(null)
  }, [id, selectedPlanId])

  const handleDownload = async () => {
    if (!id || !selectedOption) return
    setPdfLoading(true)
    setError(null)
    try {
      await downloadOrderStagePlanPdf(id, selectedOption.blockId)
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={pdfLoading || !plan}
            className="inline-flex items-center gap-1.5 rounded border-2 border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <Download size={16} />
            {pdfLoading ? 'Generowanie PDF…' : 'Pobierz PDF'}
          </button>
          {plan ? (
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
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>
      ) : null}

      <div className="mx-auto max-w-5xl rounded-xl border border-border bg-surface">
        <div className="flex justify-between border-b border-border bg-surface-2 px-4 py-2 text-sm">
          <span>
            Zlecenie: <strong className="font-mono">{orderNumberDisplay}</strong>
          </span>
          <span>Plan sceny</span>
        </div>
        <div className="space-y-4 p-4">
          <h1 className="text-lg font-bold">Plan sceny — rzut z góry</h1>

          {planOptions.length > 1 ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="stage-plan-select">
                Wybierz plan
              </label>
              <select
                id="stage-plan-select"
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
                className="w-full max-w-md rounded border border-border bg-background px-2 py-1.5 text-sm"
              >
                {planOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {!plan ? (
            <p className="text-sm text-muted-foreground">
              W tym zleceniu nie ma jeszcze złożonej sceny. Wróć do formularza i użyj przycisku „Złóż scenę z
              podestów”.
            </p>
          ) : (
            <>
              <div
                className="overflow-x-auto rounded border border-border bg-background p-2"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-1.5 pr-2">Pozycja</th>
                    <th className="py-1.5 text-right">Ilość</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.bom.map((line) => (
                    <tr key={line.catalogKey} className="border-b border-border/50">
                      <td className="py-1.5 pr-2">{line.name}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatMeters(line.quantity)} {line.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {plan.warnings.length > 0 ? (
                <ul className="space-y-1 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
                  {plan.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {plan.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
