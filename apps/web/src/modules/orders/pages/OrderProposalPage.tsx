import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, FileText, RefreshCw } from 'lucide-react'
import {
  MAX_PROPOSAL_OPTIONS,
  applyGlobalDiscountAndVat,
  computeProposalEquipmentNet,
  computeProposalProductionNet,
  groupProposalScope,
  proposalOptionKey,
  suggestProposalConcept,
  type ProposalCoreItemOverride,
  type ProposalDocumentDraft,
  type ProposalOptionRef,
  type ProposalSkin,
  type Order,
} from '@lama-stage/shared-types'
import { useOrder } from '../hooks/useOrders'
import { orderApi, type OrderDocumentExportMeta } from '../api/order.api'
import { formatOrderNumber } from '../utils/orderNumberFormat'
import ProposalClientView from '../components/ProposalClientView'
import '../components/proposalPublic.css'
import type { ProposalPublicSnapshot } from '../utils/proposalPublic'
import { formatProposalMoney } from '../utils/proposalPublic'

function emptyDraft(): ProposalDocumentDraft {
  return {
    offerExportId: null,
    skin: 'MINIMAL',
    lead: '',
    whyThisSet: '',
    options: [],
    coreItems: [],
  }
}

function upsertCoreItem(
  items: ProposalCoreItemOverride[],
  next: ProposalCoreItemOverride
): ProposalCoreItemOverride[] {
  const idx = items.findIndex((item) => item.groupId === next.groupId)
  if (idx < 0) return [...items, next]
  return items.map((item, i) => (i === idx ? next : item))
}

export default function OrderProposalPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: order, isLoading, isError } = useOrder(id || '')
  const [draft, setDraft] = useState<ProposalDocumentDraft>(emptyDraft())
  const [offerExports, setOfferExports] = useState<OrderDocumentExportMeta[]>([])
  const [proposalExports, setProposalExports] = useState<OrderDocumentExportMeta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [preview, setPreview] = useState<ProposalPublicSnapshot | null>(null)

  const loadAll = useCallback(async () => {
    if (!id) return
    const [d, offers, proposals] = await Promise.all([
      orderApi.getDocumentDraft<ProposalDocumentDraft>(id, 'PROPOSAL'),
      orderApi.getDocumentExports(id, 'OFFER'),
      orderApi.getDocumentExports(id, 'PROPOSAL'),
    ])
    setDraft({ ...emptyDraft(), ...d.payload })
    setOfferExports(offers)
    setProposalExports(proposals)
  }, [id])

  useEffect(() => {
    if (!id || isLoading) return
    loadAll().catch(() => setError('Nie udało się pobrać danych proposal.'))
  }, [id, isLoading, loadAll])

  const typedOrder = order as Order | undefined
  const blocks: Array<{ id: string; title: string; sortOrder?: number | null }> =
    typedOrder?.offerBlocks ?? []
  const equipment: Array<{
    id: string
    name: string
    category?: string | null
    offerBlockId?: string | null
    visibleInOffer?: boolean
    unitPrice: number
    quantity: number
    days?: number
    discount?: number
    pricingRule?: unknown
  }> = typedOrder?.equipmentItems ?? []
  const production: Array<{
    id: string
    name: string
    offerBlockId?: string | null
    visibleInOffer?: boolean
    isTransport?: boolean
    rateValue: number
    units?: number
    discount?: number
  }> = typedOrder?.productionItems ?? []

  const optionCandidates = useMemo(() => {
    const blockCards = blocks.map((b) => ({
      kind: 'BLOCK' as const,
      targetId: b.id,
      title: b.title,
    }))
    const looseEq = equipment
      .filter((e) => !e.offerBlockId)
      .map((e) => ({ kind: 'EQUIPMENT' as const, targetId: e.id, title: e.name }))
    const looseProd = production
      .filter((p) => !p.offerBlockId)
      .map((p) => ({ kind: 'PRODUCTION' as const, targetId: p.id, title: p.name }))
    return [...blockCards, ...looseEq, ...looseProd]
  }, [blocks, equipment, production])

  const selectedKeys = new Set(draft.options.map((o) => proposalOptionKey(o.kind, o.targetId)))

  const scopeGroups = useMemo(() => {
    const excludedEquipmentIds = new Set<string>()
    const excludedProductionIds = new Set<string>()
    const excludedBlockIds = new Set<string>()
    for (const opt of draft.options) {
      if (opt.kind === 'BLOCK') excludedBlockIds.add(opt.targetId)
      if (opt.kind === 'EQUIPMENT') excludedEquipmentIds.add(opt.targetId)
      if (opt.kind === 'PRODUCTION') excludedProductionIds.add(opt.targetId)
    }
    return groupProposalScope({
      blocks,
      equipment,
      production,
      excludedEquipmentIds,
      excludedProductionIds,
      excludedBlockIds,
    })
  }, [blocks, draft.options, equipment, production])

  const coreOverrideByGroup = useMemo(() => {
    const map = new Map((draft.coreItems ?? []).map((item) => [item.groupId, item]))
    return map
  }, [draft.coreItems])

  // Auto-wypełnij coreItems sugestią regułową, gdy draft ich jeszcze nie ma.
  useEffect(() => {
    if (scopeGroups.length === 0) return
    const existing = draft.coreItems ?? []
    const missing = scopeGroups.filter((g) => !existing.some((c) => c.groupId === g.id))
    if (missing.length === 0) return
    setDraft((prev) => {
      const current = prev.coreItems ?? []
      let next = current
      for (const group of scopeGroups) {
        if (current.some((c) => c.groupId === group.id)) continue
        next = upsertCoreItem(next, suggestProposalConcept(group))
      }
      if (next === current) return prev
      return { ...prev, coreItems: next }
    })
  }, [draft.coreItems, scopeGroups])

  const liveTotals = useMemo(() => {
    const optionEqIds = new Set<string>()
    const optionProdIds = new Set<string>()
    for (const opt of draft.options) {
      if (opt.kind === 'BLOCK') {
        for (const e of equipment) if (e.offerBlockId === opt.targetId) optionEqIds.add(e.id)
        for (const p of production) if (p.offerBlockId === opt.targetId) optionProdIds.add(p.id)
      }
      if (opt.kind === 'EQUIPMENT') optionEqIds.add(opt.targetId)
      if (opt.kind === 'PRODUCTION') optionProdIds.add(opt.targetId)
    }
    const baseEq = equipment.filter((e) => e.visibleInOffer !== false && !optionEqIds.has(e.id))
    const baseProd = production.filter(
      (p) => p.visibleInOffer !== false && !optionProdIds.has(p.id) && !p.isTransport
    )
    const baseTr = production.filter(
      (p) => p.visibleInOffer !== false && !optionProdIds.has(p.id) && p.isTransport
    )
    const net =
      baseEq.reduce((s, i) => s + computeProposalEquipmentNet(i), 0) +
      baseProd.reduce((s, i) => s + computeProposalProductionNet(i), 0) +
      baseTr.reduce((s, i) => s + computeProposalProductionNet(i), 0)
    return applyGlobalDiscountAndVat({
      netBeforeGlobal: net,
      discountGlobal: typedOrder?.discountGlobal ?? 0,
      vatRate: typedOrder?.vatRate ?? 23,
    })
  }, [draft.options, equipment, production, typedOrder?.discountGlobal, typedOrder?.vatRate])

  const patchCoreItem = (groupId: string, patch: Partial<ProposalCoreItemOverride>) => {
    setDraft((prev) => {
      const group = scopeGroups.find((g) => g.id === groupId)
      if (!group) return prev
      const current =
        prev.coreItems?.find((c) => c.groupId === groupId) ?? suggestProposalConcept(group)
      return {
        ...prev,
        coreItems: upsertCoreItem(prev.coreItems ?? [], { ...current, ...patch, groupId }),
      }
    })
  }

  const resetCoreSuggestion = (groupId: string) => {
    const group = scopeGroups.find((g) => g.id === groupId)
    if (!group) return
    setDraft((prev) => ({
      ...prev,
      coreItems: upsertCoreItem(prev.coreItems ?? [], suggestProposalConcept(group)),
    }))
  }

  const toggleOption = (kind: ProposalOptionRef['kind'], targetId: string) => {
    const key = proposalOptionKey(kind, targetId)
    setDraft((prev) => {
      const exists = prev.options.some((o) => proposalOptionKey(o.kind, o.targetId) === key)
      if (exists) return { ...prev, options: prev.options.filter((o) => proposalOptionKey(o.kind, o.targetId) !== key) }
      if (prev.options.length >= MAX_PROPOSAL_OPTIONS) return prev
      return {
        ...prev,
        options: [...prev.options, { id: key, kind, targetId, rationale: '' }],
      }
    })
  }

  const setRationale = (key: string, rationale: string) => {
    setDraft((prev) => ({
      ...prev,
      options: prev.options.map((o) => (proposalOptionKey(o.kind, o.targetId) === key ? { ...o, rationale } : o)),
    }))
  }

  const saveDraft = async () => {
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      const saved = await orderApi.updateDocumentDraft<ProposalDocumentDraft>(id, 'PROPOSAL', draft)
      setDraft({ ...emptyDraft(), ...saved.payload })
      setInfo('Zapisano draft.')
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: { message?: string } | string } } }
      const raw = ax.response?.data?.error
      setError(typeof raw === 'string' ? raw : raw?.message ?? 'Nie udało się zapisać draftu.')
    } finally {
      setSaving(false)
    }
  }

  const publish = async () => {
    if (!id) return
  const payload: ProposalDocumentDraft = {
    ...draft,
    offerExportId: draft.offerExportId || offerExports[0]?.id || null,
  }
  setPublishing(true)
  setError(null)
  setInfo(null)
  try {
    await orderApi.updateDocumentDraft<ProposalDocumentDraft>(id, 'PROPOSAL', payload)
    const created = await orderApi.createDocumentExport(id, 'PROPOSAL')
      await loadAll()
      const token = created.publicToken
      setInfo(
        token
          ? `Opublikowano ${created.documentNumber}. Link jest przypięty do tej wersji.`
          : `Opublikowano ${created.documentNumber}.`
      )
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: { message?: string } | string } } }
      const raw = ax.response?.data?.error
      setError(typeof raw === 'string' ? raw : raw?.message ?? 'Nie udało się opublikować proposal.')
    } finally {
      setPublishing(false)
    }
  }

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/p/${token}`
    await navigator.clipboard.writeText(url)
    setInfo(`Skopiowano: ${url}`)
  }

  const loadPreview = async (exportId: string) => {
    if (!id) return
    const doc = await orderApi.getDocumentExport(id, exportId)
    setPreview(doc.snapshot as ProposalPublicSnapshot)
  }

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Ładowanie…</div>
  if (isError || !order) return <div className="p-4 text-sm text-muted-foreground">Nie znaleziono zlecenia.</div>

  const currency = (order.currency === 'EUR' ? 'EUR' : 'PLN') as 'PLN' | 'EUR'
  const latestOfferId = offerExports[0]?.id ?? null
  const effectiveOfferId = draft.offerExportId || latestOfferId

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => navigate(`/orders/${id}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={18} />
          Powrót do zlecenia
        </button>
        <p className="text-xs text-muted-foreground">
          {formatOrderNumber(order.orderNumber, order.orderYear)} · {order.name}
        </p>
      </div>

      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      {info ? <p className="mb-3 text-sm text-success">{info}</p> : null}

      {offerExports.length === 0 ? (
        <div className="border border-border rounded p-4 text-sm">
          <p className="mb-2">Proposal wymaga najpierw wygenerowanej Oferty PDF.</p>
          <Link to={`/orders/${id}/offer`} className="text-primary underline">
            Przejdź do Oferty
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <section className="border border-border rounded p-4 space-y-3">
              <h2 className="text-sm font-semibold">Snapshot Oferty</h2>
              <select
                className="w-full bg-surface border border-border rounded px-2 py-2 text-sm"
                value={effectiveOfferId ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, offerExportId: e.target.value || null }))}
              >
                {offerExports.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.documentNumber} · {new Date(exp.exportedAt).toLocaleString('pl-PL')}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                PDF w proposal to zawsze ten snapshot. Nowy link = nowa wersja; stary link się nie zmienia.
              </p>
            </section>

            <section className="border border-border rounded p-4 space-y-3">
              <h2 className="text-sm font-semibold">Skin</h2>
              <div className="flex gap-2">
                {(['MINIMAL', 'DYNAMIC'] as ProposalSkin[]).map((skin) => (
                  <button
                    key={skin}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, skin }))}
                    className={`px-3 py-2 text-sm border rounded ${
                      draft.skin === skin ? 'border-primary text-primary' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {skin === 'MINIMAL' ? 'Minimal' : 'Dynamiczny'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Minimal — jasny, korporacyjny. Dynamiczny — ciemny, energiczny (echo lamastage.pl).
              </p>
            </section>

            <section className="border border-border rounded p-4 space-y-3">
              <h2 className="text-sm font-semibold">Treść</h2>
              <textarea
                className="w-full bg-surface border border-border rounded px-2 py-2 text-sm min-h-[72px]"
                placeholder="Lead sprzedażowy"
                value={draft.lead}
                maxLength={800}
                onChange={(e) => setDraft((d) => ({ ...d, lead: e.target.value }))}
              />
              <textarea
                className="w-full bg-surface border border-border rounded px-2 py-2 text-sm min-h-[96px]"
                placeholder="Dlaczego taki zestaw"
                value={draft.whyThisSet}
                maxLength={2000}
                onChange={(e) => setDraft((d) => ({ ...d, whyThisSet: e.target.value }))}
              />
            </section>

            <section className="border border-border rounded p-4 space-y-3">
              <h2 className="text-sm font-semibold">Core sprzedażowe</h2>
              <p className="text-xs text-muted-foreground">
                Maszynowa propozycja z oferty: fakty z liczbami + jedno zdanie korzyści. Ceny tylko z
                pozycji zlecenia — możesz poprawić tekst przed publikacją.
              </p>
              {scopeGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brak pozycji w zakresie bazowym.</p>
              ) : (
                <div className="space-y-3">
                  {scopeGroups.map((group) => {
                    const suggestion = suggestProposalConcept(group)
                    const override = coreOverrideByGroup.get(group.id)
                    const title = override?.title ?? suggestion.title
                    const facts = override?.facts?.length ? override.facts : suggestion.facts
                    const benefit = override?.benefit ?? suggestion.benefit
                    const netBefore = group.equipmentNet + group.productionNet + group.transportNet
                    const money = applyGlobalDiscountAndVat({
                      netBeforeGlobal: netBefore,
                      discountGlobal: typedOrder?.discountGlobal ?? 0,
                      vatRate: typedOrder?.vatRate ?? 23,
                    })
                    return (
                      <div key={group.id} className="border border-border rounded p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <input
                            className="w-full bg-surface border border-border rounded px-2 py-1.5 text-sm font-medium"
                            value={title}
                            maxLength={120}
                            onChange={(e) => patchCoreItem(group.id, { title: e.target.value })}
                          />
                          <button
                            type="button"
                            title="Zaproponuj ponownie"
                            className="shrink-0 p-1.5 border border-border rounded text-muted-foreground hover:text-foreground"
                            onClick={() => resetCoreSuggestion(group.id)}
                          >
                            <RefreshCw size={14} />
                          </button>
                        </div>
                        <div className="space-y-1">
                          {facts.map((fact, factIdx) => (
                            <div key={`${group.id}-fact-${factIdx}`} className="flex gap-1">
                              <input
                                className="w-full bg-surface border border-border rounded px-2 py-1 text-sm"
                                value={fact}
                                maxLength={160}
                                onChange={(e) => {
                                  const next = [...facts]
                                  next[factIdx] = e.target.value
                                  patchCoreItem(group.id, { facts: next })
                                }}
                              />
                              <button
                                type="button"
                                className="px-2 text-xs border border-border rounded"
                                onClick={() =>
                                  patchCoreItem(group.id, {
                                    facts: facts.filter((_, i) => i !== factIdx),
                                  })
                                }
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          {facts.length < 5 ? (
                            <button
                              type="button"
                              className="text-xs text-primary"
                              onClick={() => patchCoreItem(group.id, { facts: [...facts, ''] })}
                            >
                              + fakt
                            </button>
                          ) : null}
                        </div>
                        <textarea
                          className="w-full bg-surface border border-border rounded px-2 py-1.5 text-sm min-h-[64px]"
                          value={benefit}
                          maxLength={400}
                          onChange={(e) => patchCoreItem(group.id, { benefit: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          {formatProposalMoney(money.netAfterDiscount, currency)} netto (z pozycji oferty)
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="border border-border rounded p-4 space-y-3">
              <h2 className="text-sm font-semibold">
                Opcje rozbudowy ({draft.options.length}/{MAX_PROPOSAL_OPTIONS})
              </h2>
              <div className="space-y-2">
                {optionCandidates.map((c) => {
                  const key = proposalOptionKey(c.kind, c.targetId)
                  const on = selectedKeys.has(key)
                  const ref = draft.options.find((o) => proposalOptionKey(o.kind, o.targetId) === key)
                  return (
                    <div key={key} className="border border-border rounded p-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleOption(c.kind, c.targetId)}
                        />
                        <span>
                          {c.title}{' '}
                          <span className="text-xs text-muted-foreground">
                            {c.kind === 'BLOCK' ? 'blok' : c.kind === 'EQUIPMENT' ? 'sprzęt' : 'obsługa'}
                          </span>
                        </span>
                      </label>
                      {on ? (
                        <input
                          className="mt-2 w-full bg-surface border border-border rounded px-2 py-1 text-sm"
                          placeholder="Dlaczego warto"
                          value={ref?.rationale ?? ''}
                          maxLength={500}
                          onChange={(e) => setRationale(key, e.target.value)}
                        />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={saving}
                className="px-3 py-2 text-sm border border-border rounded"
              >
                {saving ? 'Zapis…' : 'Zapisz draft'}
              </button>
              <button
                type="button"
                onClick={() => void publish()}
                disabled={publishing || !effectiveOfferId}
                className="px-3 py-2 text-sm border-2 border-primary text-primary rounded"
              >
                {publishing ? 'Publikacja…' : 'Publikuj wersję'}
              </button>
            </div>
          </div>

          <aside className="border border-border rounded p-4 h-fit space-y-3 text-sm">
            <h2 className="font-semibold">Podsumowanie bazowe</h2>
            <p>Netto {formatProposalMoney(liveTotals.netAfterDiscount, currency)}</p>
            <p>VAT {formatProposalMoney(liveTotals.vatAmount, currency)}</p>
            <p className="font-semibold">Brutto {formatProposalMoney(liveTotals.grossTotal, currency)}</p>
            <p className="text-xs text-muted-foreground">Bez marży. Opcje liczone osobno w snapshotcie.</p>
          </aside>
        </div>
      )}

      <section className="mt-6 border border-border rounded p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <FileText size={16} />
          Opublikowane wersje
        </h2>
        {proposalExports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak publikacji.</p>
        ) : (
          <div className="space-y-2">
            {proposalExports.map((exp) => (
              <div key={exp.id} className="border border-border rounded p-3 text-sm space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{exp.documentNumber}</strong>
                  <span className="text-xs text-muted-foreground">
                    {new Date(exp.exportedAt).toLocaleString('pl-PL')}
                    {exp.expiresAt ? ` · do ${new Date(exp.expiresAt).toLocaleDateString('pl-PL')}` : ''}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Otwarcia {exp.eventCounts?.OPEN ?? 0} · PDF {exp.eventCounts?.PDF ?? 0} · CTA {exp.eventCounts?.CTA ?? 0}
                </p>
                {exp.clientSignals?.discussRequestedAt ? (
                  <p className="text-xs text-primary">Klient chce omówić tę wersję</p>
                ) : null}
                {(exp.clientSignals?.interestedOptionIds.length ?? 0) > 0 ? (
                  <p className="text-xs">Zainteresowanie opcjami: {exp.clientSignals?.interestedOptionIds.length}</p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  {exp.publicToken ? (
                    <button
                      type="button"
                      className="text-xs flex items-center gap-1 border border-border rounded px-2 py-1"
                      onClick={() => void copyLink(exp.publicToken!)}
                    >
                      <Copy size={12} />
                      Kopiuj link
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-xs border border-border rounded px-2 py-1"
                    onClick={() => void loadPreview(exp.id)}
                  >
                    Podgląd snapshotu
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {preview ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold mb-2">Podgląd opublikowanej wersji</h2>
          <div
            className={`border border-border rounded overflow-hidden ${
              preview.skin === 'DYNAMIC' ? 'proposal-skin-dynamic' : 'proposal-skin-minimal'
            }`}
          >
            <ProposalClientView snapshot={preview} />
          </div>
        </section>
      ) : null}
    </div>
  )
}
