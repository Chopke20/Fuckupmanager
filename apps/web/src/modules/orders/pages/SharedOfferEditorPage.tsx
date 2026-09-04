import { useCallback, useEffect, useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import {
  Calendar,
  DollarSign,
  FileText,
  Save,
  Truck,
} from 'lucide-react'
import type {
  Order,
  OrderEquipmentItem,
  OrderOfferBlock,
  OrderProductionItem,
  OrderStage,
  SharedOfferPartnerLine,
  SharedOfferPublicView,
} from '@lama-stage/shared-types'
import { applyCompanyTheme, resetCompanyTheme } from '../../../lib/companyTheme'
import { daysBetween } from '../../../shared/utils/dateHelpers'
import { randomClientUuid } from '../../../shared/utils/uuid'
import { formatOrderNumber } from '../utils/orderNumberFormat'
import { TOINEN_ACCENT_HEX, toinenLogoDataUri } from '../utils/toinenBrand'
import {
  SharedOfferLockedChangedError,
  sharedOfferPublicApi,
} from '../api/sharedOffer.api'
import OrderHeaderSection from '../components/OrderHeaderSection'
import OrderScheduleSection from '../components/OrderScheduleSection'
import OrderOfferBlocksEditor from '../components/OrderOfferBlocksEditor'
import OrderEquipmentSection from '../components/OrderEquipmentSection'
import OrderProductionSection from '../components/OrderProductionSection'
import OrderTransportSection from '../components/OrderTransportSection'
import OrderFinancialSection from '../components/OrderFinancialSection'
import LockedFieldHint from '../components/LockedFieldHint'

type FormValues = Partial<Order> & {
  equipmentItems: Partial<OrderEquipmentItem>[]
  productionItems: Partial<OrderProductionItem>[]
  offerBlocks: Partial<OrderOfferBlock>[]
  stages: Partial<OrderStage>[]
}

function viewToForm(view: SharedOfferPublicView): FormValues {
  const lockedEq = view.lockedLines
    .filter((l) => l.kind === 'EQUIPMENT')
    .map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description ?? undefined,
      category: l.category ?? 'Inne',
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      days: l.days,
      discount: l.discount,
      offerBlockId: l.offerBlockId,
      sortOrder: l.sortOrder,
      visibleInOffer: true,
    }))

  const partnerEq = view.partnerLines
    .filter((l) => l.kind === 'EQUIPMENT')
    .map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description || undefined,
      category: l.category || 'Inne',
      quantity: Math.max(1, Math.round(l.quantity) || 1),
      unitPrice: l.unitPrice,
      days: l.days,
      discount: l.discount,
      offerBlockId: l.offerBlockId,
      sortOrder: l.sortOrder,
      visibleInOffer: true,
    }))

  const lockedProd = view.lockedLines
    .filter((l) => l.kind === 'PRODUCTION')
    .map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description ?? undefined,
      rateType: (l.rateType as OrderProductionItem['rateType']) || 'FLAT',
      rateValue: l.unitPrice,
      units: l.quantity,
      discount: l.discount,
      offerBlockId: l.offerBlockId,
      sortOrder: l.sortOrder,
      isTransport: Boolean(l.isTransport),
      isAutoCalculated: false,
      visibleInOffer: true,
      stageIds: l.stageIds ?? undefined,
    }))

  const partnerProd = view.partnerLines
    .filter((l) => l.kind === 'PRODUCTION')
    .map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description || undefined,
      rateType: 'FLAT' as const,
      rateValue: l.unitPrice,
      units: l.quantity,
      discount: l.discount,
      offerBlockId: l.offerBlockId,
      sortOrder: l.sortOrder,
      isTransport: false,
      isAutoCalculated: false,
      visibleInOffer: true,
    }))

  return {
    name: view.orderName,
    status: view.orderStatus as Order['status'],
    description: view.description ?? undefined,
    venue: view.venue ?? undefined,
    venuePlaceId: view.venuePlaceId ?? undefined,
    dateFrom: view.dateFrom,
    dateTo: view.dateTo,
    startDate: view.startDate,
    endDate: view.endDate,
    orderNumber: view.orderNumber ?? undefined,
    orderYear: view.orderYear ?? undefined,
    clientId: undefined,
    discountGlobal: view.totals.discountGlobal,
    vatRate: view.totals.vatRate,
    currency: view.totals.currency as Order['currency'],
    stages: view.stages.map((s) => ({
      id: s.id,
      type: s.type as OrderStage['type'],
      label: s.label ?? undefined,
      date: s.date,
      timeStart: s.timeStart ?? undefined,
      timeEnd: s.timeEnd ?? undefined,
      notes: s.notes ?? undefined,
      sortOrder: s.sortOrder,
    })),
    offerBlocks: view.blocks.map((b) => ({
      id: b.id,
      title: b.title,
      sortOrder: b.sortOrder,
    })),
    equipmentItems: [...lockedEq, ...partnerEq],
    productionItems: [...lockedProd, ...partnerProd],
  }
}

function extractPartnerLines(
  equipmentItems: Partial<OrderEquipmentItem>[],
  productionItems: Partial<OrderProductionItem>[],
  lockedIds: Set<string>
): SharedOfferPartnerLine[] {
  const lines: SharedOfferPartnerLine[] = []
  let sort = 0
  for (const item of equipmentItems) {
    const id = item.id
    if (!id || lockedIds.has(id)) continue
    const name = (item.name ?? '').trim()
    if (!name) continue
    lines.push({
      id,
      kind: 'EQUIPMENT',
      name,
      description: (item.description ?? '').trim(),
      category: (item.category ?? 'Inne').trim() || 'Inne',
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      days: Math.max(1, Number(item.days) || 1),
      discount: Number(item.discount) || 0,
      offerBlockId: item.offerBlockId ?? null,
      sortOrder: sort++,
    })
  }
  for (const item of productionItems) {
    const id = item.id
    if (!id || lockedIds.has(id)) continue
    if (item.isTransport) continue
    const name = (item.name ?? '').trim()
    if (!name) continue
    lines.push({
      id,
      kind: 'PRODUCTION',
      name,
      description: (item.description ?? '').trim(),
      category: 'Inne',
      quantity: Number(item.units) || 0,
      unitPrice: Number(item.rateValue) || 0,
      days: 1,
      discount: Number(item.discount) || 0,
      offerBlockId: item.offerBlockId ?? null,
      sortOrder: sort++,
    })
  }
  return lines
}

export default function SharedOfferEditorPage() {
  const { token } = useParams<{ token: string }>()
  const [view, setView] = useState<SharedOfferPublicView | null>(null)
  const [loading, setLoading] = useState(true)
  const [inactive, setInactive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [lockedStale, setLockedStale] = useState(false)
  const [busy, setBusy] = useState<'save' | 'pdf' | null>(null)
  const [activeSection, setActiveSection] = useState('header')

  const methods = useForm<FormValues>({
    defaultValues: {
      equipmentItems: [],
      productionItems: [],
      offerBlocks: [],
      stages: [],
    },
  })
  const { watch, reset, setValue, getValues } = methods

  const lockedIds = useMemo(
    () => new Set((view?.lockedLines ?? []).map((l) => l.id)),
    [view?.lockedLines]
  )

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await sharedOfferPublicApi.get(token)
      setView(data)
      reset(viewToForm(data))
      setDirty(false)
      setLockedStale(false)
      setInactive(false)
      applyCompanyTheme(data.brandAccentHex || TOINEN_ACCENT_HEX)
    } catch {
      setInactive(true)
      setError('Link nie jest już aktywny albo jest nieprawidłowy.')
    } finally {
      setLoading(false)
    }
  }, [token, reset])

  useEffect(() => {
    void load()
    return () => {
      resetCompanyTheme()
    }
  }, [load])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const formData = watch()
  const equipmentItems = (watch('equipmentItems') ?? []) as Partial<OrderEquipmentItem>[]
  const allProductionItems = (watch('productionItems') ?? []) as Partial<OrderProductionItem>[]
  const offerBlocksRaw = watch('offerBlocks') ?? []
  const stages = (watch('stages') ?? []) as Partial<OrderStage>[]
  const productionItems = allProductionItems.filter((p) => !p.isTransport)
  const transportItems = allProductionItems.filter((p) => p.isTransport)
  const hasOfferBlocks = (offerBlocksRaw as Partial<OrderOfferBlock>[]).length > 0

  const orderDays = useMemo(() => {
    const from = formData.dateFrom as string | undefined
    const to = formData.dateTo as string | undefined
    if (!from || !to) return 1
    try {
      return Math.max(1, daysBetween(from, to))
    } catch {
      return 1
    }
  }, [formData.dateFrom, formData.dateTo])

  const markDirty = () => setDirty(true)

  const handleOrderChange = (updates: Partial<Order>) => {
    for (const [key, value] of Object.entries(updates)) {
      setValue(key as any, value as any, { shouldDirty: true })
    }
    markDirty()
  }

  const handleStagesChange = (nextStages: Partial<OrderStage>[]) => {
    setValue('stages', nextStages, { shouldDirty: true })
    markDirty()
  }

  const handleEquipmentChange = (items: Partial<OrderEquipmentItem>[]) => {
    const next = items.map((item) =>
      item.id ? item : { ...item, id: randomClientUuid(), visibleInOffer: true }
    )
    setValue('equipmentItems', next, { shouldDirty: true })
    markDirty()
  }

  const handleProductionChange = (items: Partial<OrderProductionItem>[]) => {
    const transport = (getValues('productionItems') ?? []).filter((p) => p.isTransport)
    const nextNonTransport = items.map((item) =>
      item.id
        ? item
        : {
            ...item,
            id: randomClientUuid(),
            rateType: item.rateType || 'FLAT',
            isTransport: false,
            visibleInOffer: true,
          }
    )
    setValue('productionItems', [...nextNonTransport, ...transport], { shouldDirty: true })
    markDirty()
  }

  const handleOfferBlocksChange = (blocks: Partial<OrderOfferBlock>[]) => {
    setValue('offerBlocks', blocks, { shouldDirty: true })
    markDirty()
  }

  const applyLockedChanged = (next: SharedOfferPublicView, keepPartnerLines: SharedOfferPartnerLine[]) => {
    const merged: SharedOfferPublicView = { ...next, partnerLines: keepPartnerLines }
    setView(merged)
    reset(viewToForm(merged))
    setLockedStale(true)
    setInfo('Pozycje Lama Stage zmieniły się od otwarcia edytora. Odśwież zablokowaną część przed zapisem lub PDF.')
  }

  const currentPartnerLines = () =>
    extractPartnerLines(
      (getValues('equipmentItems') ?? []) as Partial<OrderEquipmentItem>[],
      (getValues('productionItems') ?? []) as Partial<OrderProductionItem>[],
      lockedIds
    )

  const save = async () => {
    if (!token || !view) return
    setBusy('save')
    setError(null)
    setInfo(null)
    try {
      const lines = currentPartnerLines()
      const description = (getValues('description') as string | undefined) ?? ''
      const formStages = (getValues('stages') ?? []) as Partial<OrderStage>[]
      const stages = formStages.map((s, idx) => {
        const dateRaw = s.date
        const date =
          typeof dateRaw === 'string'
            ? dateRaw
            : dateRaw
              ? new Date(dateRaw as unknown as string | number | Date).toISOString()
              : new Date().toISOString()
        return {
          id: s.id,
          type: String(s.type || 'CUSTOM'),
          label: s.label ?? null,
          date,
          timeStart: s.timeStart ?? null,
          timeEnd: s.timeEnd ?? null,
          notes: s.notes ?? null,
          sortOrder: s.sortOrder ?? idx,
        }
      })
      const next = await sharedOfferPublicApi.save(token, {
        lines,
        lockedFingerprint: view.lockedFingerprint,
        description,
        stages,
      })
      setView(next)
      reset(viewToForm(next))
      setDirty(false)
      setLockedStale(false)
      setInfo('Zapisano.')
    } catch (e) {
      if (e instanceof SharedOfferLockedChangedError) {
        applyLockedChanged(e.view, currentPartnerLines())
      } else {
        setError('Nie udało się zapisać.')
      }
    } finally {
      setBusy(null)
    }
  }

  const generatePdf = async () => {
    if (!token || !view) return
    if (dirty) {
      setError('Najpierw zapisz pozycje, potem wygeneruj PDF.')
      return
    }
    setBusy('pdf')
    setError(null)
    setInfo(null)
    try {
      await sharedOfferPublicApi.generatePdf(token, view.lockedFingerprint)
      setInfo('PDF wygenerowany.')
    } catch (e) {
      if (e instanceof SharedOfferLockedChangedError) {
        applyLockedChanged(e.view, currentPartnerLines())
      } else if (e instanceof Error) {
        setError(e.message)
      } else {
        setError('Nie udało się wygenerować PDF.')
      }
    } finally {
      setBusy(null)
    }
  }

  const sections = useMemo(() => {
    const base = [
      { id: 'header', label: 'Nagłówek', icon: <FileText size={18} /> },
      { id: 'schedule', label: 'Harmonogram', icon: <Calendar size={18} /> },
    ]
    if (hasOfferBlocks) {
      base.push({ id: 'offer-blocks', label: 'Bloki oferty', icon: <FileText size={18} /> })
    } else {
      base.push(
        { id: 'equipment', label: 'Sprzęt', icon: <FileText size={18} /> },
        { id: 'production', label: 'Produkcja', icon: <FileText size={18} /> }
      )
    }
    base.push(
      { id: 'transport', label: 'Transport', icon: <Truck size={18} /> },
      { id: 'financial', label: 'Finanse', icon: <DollarSign size={18} /> }
    )
    return base
  }, [hasOfferBlocks])

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId)
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const partnerBreakdown = useMemo(() => {
    if (!view) return null
    const lines = extractPartnerLines(equipmentItems, allProductionItems, lockedIds)
    const partnerNet = Math.round(
      lines.reduce((sum, l) => {
        const base =
          l.kind === 'EQUIPMENT'
            ? l.quantity * l.unitPrice * (l.days || 1)
            : l.quantity * l.unitPrice
        return sum + base * (1 - (l.discount || 0) / 100)
      }, 0) * 100
    ) / 100
    return {
      ownNet: view.totals.ownNet,
      partnerNet,
      currency: view.totals.currency,
    }
  }, [view, equipmentItems, allProductionItems, lockedIds])

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-muted-foreground">Ładowanie edytora…</div>
      </div>
    )
  }

  if (inactive || !view) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-3 px-4">
        <h1 className="text-xl font-bold">Link nie jest już aktywny</h1>
        <p className="text-muted-foreground text-center">
          {error ?? 'Oferta współdzielona została unieważniona lub nie istnieje.'}
        </p>
      </div>
    )
  }

  const orderNumberDisplay = formatOrderNumber(view.orderNumber, view.orderYear)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-surface">
        <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={toinenLogoDataUri()}
              alt="Toinen Music"
              className="h-8 w-auto max-w-[140px] object-contain"
            />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Oferta współdzielona
              </div>
              <div className="font-semibold truncate">{view.orderName}</div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy !== null || !dirty}
              className="px-3 py-1.5 text-sm border-2 border-primary text-primary bg-transparent rounded font-medium hover:bg-primary/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save size={18} />
              {busy === 'save' ? 'Zapisywanie…' : 'Zapisz'}
            </button>
            <button
              type="button"
              onClick={() => void generatePdf()}
              disabled={busy !== null || lockedStale}
              className="px-3 py-1.5 text-sm border-2 border-primary text-primary bg-transparent rounded font-medium hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {busy === 'pdf' ? 'Generowanie…' : 'Generuj ofertę PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 py-4">
        {lockedStale ? (
          <div className="mb-3 flex items-center justify-between gap-2 rounded px-3 py-2 text-sm bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200">
            <span>Pozycje Lama Stage zmieniły się. Twoje pozycje zostają — odśwież zablokowaną część.</span>
            <button
              type="button"
              onClick={() => void load()}
              className="px-2 py-1 rounded border border-border hover:bg-surface-2 text-xs"
            >
              Odśwież
            </button>
          </div>
        ) : null}
        {error ? (
          <div className="mb-3 px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
            {error}
          </div>
        ) : null}
        {info ? (
          <div className="mb-3 px-3 py-2 rounded bg-primary/10 border border-primary/30 text-sm">{info}</div>
        ) : null}

        <FormProvider {...methods}>
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="p-3 border-b border-border">
              <h1 className="text-xl font-bold">
                Edytuj zlecenie
                <span className="ml-2 font-mono text-primary">{orderNumberDisplay}</span>
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Edytujesz zlecenie: {view.orderName} · możesz dodawać własne pozycje Toinen Music
              </p>
            </div>

            <div className="sticky top-0 z-10 bg-surface border-b border-border">
              <div className="px-3 py-1.5 flex flex-wrap gap-3">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${
                      activeSection === section.id
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {section.icon}
                    {section.label}
                    {activeSection === section.id && (
                      <div className="w-2 h-2 bg-primary rounded-full ml-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4">
              <section id="header" className="scroll-mt-24 mb-6">
                <OrderHeaderSection
                  readOnly
                  descriptionEditable
                  clientLabel={view.clientCompanyName}
                  onChange={handleOrderChange}
                />
              </section>

              <section id="schedule" className="scroll-mt-24 mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                  <Calendar size={24} />
                  Harmonogram
                </h2>
                <OrderScheduleSection
                  orderDateFrom={typeof formData.dateFrom === 'string' ? formData.dateFrom : undefined}
                  onChange={handleStagesChange}
                />
              </section>

              {hasOfferBlocks ? (
                <section id="offer-blocks" className="scroll-mt-24 mb-6">
                  <OrderOfferBlocksEditor
                    readOnly
                    partnerMode
                    lockedItemIds={lockedIds}
                    blocks={(offerBlocksRaw as Partial<OrderOfferBlock>[]) ?? []}
                    onBlocksChange={handleOfferBlocksChange}
                    equipmentItems={equipmentItems}
                    onEquipmentChange={handleEquipmentChange}
                    productionItems={productionItems}
                    onProductionChange={handleProductionChange}
                    stages={stages}
                    orderDateFrom={typeof formData.dateFrom === 'string' ? formData.dateFrom : undefined}
                    orderDateTo={typeof formData.dateTo === 'string' ? formData.dateTo : undefined}
                    orderSpanDays={orderDays}
                  />
                </section>
              ) : (
                <>
                  <section id="equipment" className="scroll-mt-24 mb-6">
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                      <FileText size={24} />
                      Wykaz sprzętu
                    </h2>
                    <OrderEquipmentSection
                      partnerMode
                      lockedItemIds={lockedIds}
                      items={equipmentItems}
                      onChange={handleEquipmentChange}
                      orderDateFrom={typeof formData.dateFrom === 'string' ? formData.dateFrom : undefined}
                      orderDateTo={typeof formData.dateTo === 'string' ? formData.dateTo : undefined}
                      orderSpanDays={orderDays}
                    />
                  </section>
                  <section id="production" className="scroll-mt-24 mb-6">
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                      <FileText size={24} />
                      Produkcja / zasoby
                    </h2>
                    <OrderProductionSection
                      partnerMode
                      lockedItemIds={lockedIds}
                      items={productionItems}
                      stages={stages}
                      onChange={handleProductionChange}
                    />
                  </section>
                </>
              )}

              <section id="transport" className="scroll-mt-24 mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                  <Truck size={24} />
                  Transport
                  <LockedFieldHint />
                </h2>
                <OrderTransportSection
                  readOnly
                  items={transportItems}
                  stages={stages}
                  orderDateFrom={formData.dateFrom}
                  orderDateTo={formData.dateTo}
                  distanceKm={null}
                  onChange={() => undefined}
                />
              </section>

              <section id="financial" className="scroll-mt-24 mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                  <DollarSign size={24} />
                  Finanse
                  <LockedFieldHint />
                </h2>
                <OrderFinancialSection
                  readOnly
                  partnerBreakdown={partnerBreakdown}
                  order={formData}
                  equipmentItems={equipmentItems}
                  productionItems={allProductionItems}
                  stages={stages}
                  onChange={() => undefined}
                  onEquipmentMarginPatch={() => undefined}
                  onProductionMarginPatch={() => undefined}
                />
              </section>
            </div>
          </div>
        </FormProvider>
      </div>
    </div>
  )
}
