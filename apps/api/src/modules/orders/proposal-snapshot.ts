import {
  OfferDocumentDraftSchema,
  ProposalDocumentDraftSchema,
  applyGlobalDiscountAndVat,
  computeProposalEquipmentNet,
  computeProposalProductionNet,
  groupProposalScope,
  proposalOptionKey,
  suggestProposalConcept,
  type ProposalCoreItemOverride,
  type ProposalDocumentDraft,
  type ProposalOptionRef,
  type ProposalScopeBlock,
  type ProposalScopeEquipmentLine,
  type ProposalScopeProductionLine,
  type ProposalSkin,
} from '@lama-stage/shared-types'
import { parseJsonSafely } from './order-document-draft-utils'

/** @deprecated Use `ProposalScopeEquipmentLine` from `@lama-stage/shared-types` — kept as an alias so existing imports keep working. */
export type ProposalEquipmentLine = ProposalScopeEquipmentLine

/** @deprecated Use `ProposalScopeProductionLine` from `@lama-stage/shared-types` — kept as an alias so existing imports keep working. */
export type ProposalProductionLine = ProposalScopeProductionLine

/** @deprecated Use `ProposalScopeBlock` from `@lama-stage/shared-types` — kept as an alias so existing imports keep working. */
export type ProposalBlock = ProposalScopeBlock

export type ProposalPublicScopeGroup = {
  id: string
  title: string
  itemNames: string[]
  equipmentNet: number
  productionNet: number
  transportNet: number
}

export type ProposalPublicOptionCard = {
  id: string
  title: string
  rationale: string
  kind: ProposalOptionRef['kind']
  netAfterDiscount: number
  vatAmount: number
  grossTotal: number
}

/**
 * Koncept sprzedażowy jednej grupy zakresu bazowego — to jest to, co faktycznie widzi klient
 * zamiast surowego dumpu pozycji (`ProposalPublicScopeGroup.itemNames`), patrz brief
 * `lama-proposal-online.mdc` §"Co proposal ma sprzedawać". Tekst pochodzi z nadpisania operatora
 * (`ProposalDocumentDraft.coreItems`) albo, gdy operator go nie uzupełnił, z silnika regułowego
 * `suggestProposalConcept` — cena zawsze liczona z pozycji zlecenia, nigdy z tekstu.
 */
export type ProposalPublicCoreItem = {
  id: string
  title: string
  facts: string[]
  benefit: string
  netAfterDiscount: number
  vatAmount: number
  grossTotal: number
}

export type ProposalPublicSnapshot = {
  documentType: 'PROPOSAL'
  documentNumber: string
  generatedAt: string
  expiresAt: string
  validityDays: number
  skin: ProposalSkin
  lead: string
  whyThisSet: string
  event: {
    name: string
    venue: string | null
    dateFrom: string
    dateTo: string
    clientCompanyName: string
  }
  branding: {
    brandName: string
    logoUrl: string | null
    primaryColorHex: string | null
  }
  issuer: {
    companyName: string
    email: string
    phone: string
  }
  contact: {
    name: string | null
    phone: string | null
    email: string | null
  }
  /** @deprecated Zachowane dla starych snapshotów / debugu operatorskiego — klient renderuje `coreItems`, nie surowy dump nazw. */
  scope: ProposalPublicScopeGroup[]
  coreItems: ProposalPublicCoreItem[]
  options: ProposalPublicOptionCard[]
  finance: {
    currency: 'PLN' | 'EUR'
    vatRate: number
    discountGlobal: number
    equipmentNet: number
    productionNet: number
    transportNet: number
    netAfterDiscount: number
    vatAmount: number
    grossTotal: number
  }
  offer: {
    exportId: string
    documentNumber: string
  }
}

function round2(n: number): number {
  return Number(n.toFixed(2))
}

export function parseProposalDraft(raw: unknown): ProposalDocumentDraft {
  const parsed = ProposalDocumentDraftSchema.safeParse(raw ?? {})
  if (parsed.success) return parsed.data
  return ProposalDocumentDraftSchema.parse({
    offerExportId: null,
    skin: 'MINIMAL',
    lead: '',
    whyThisSet: '',
    options: [],
    coreItems: [],
  })
}

export function defaultProposalLead(orderName: string): string {
  const name = orderName.trim() || 'wydarzenie'
  return `Rekomendowany zestaw realizacji dla wydarzenia „${name}”.`
}

type OptionSet = {
  blockIds: Set<string>
  equipmentIds: Set<string>
  productionIds: Set<string>
  refs: ProposalOptionRef[]
}

function collectOptionSet(options: ProposalOptionRef[]): OptionSet {
  const blockIds = new Set<string>()
  const equipmentIds = new Set<string>()
  const productionIds = new Set<string>()
  for (const opt of options) {
    if (opt.kind === 'BLOCK') blockIds.add(opt.targetId)
    if (opt.kind === 'EQUIPMENT') equipmentIds.add(opt.targetId)
    if (opt.kind === 'PRODUCTION') productionIds.add(opt.targetId)
  }
  return { blockIds, equipmentIds, productionIds, refs: options }
}

function isVisibleInOffer(flag: boolean | null | undefined): boolean {
  return flag !== false
}

function isOptionEquipment(item: ProposalEquipmentLine, set: OptionSet): boolean {
  if (set.equipmentIds.has(item.id)) return true
  if (item.offerBlockId && set.blockIds.has(item.offerBlockId)) return true
  return false
}

function isOptionProduction(item: ProposalProductionLine, set: OptionSet): boolean {
  if (set.productionIds.has(item.id)) return true
  if (item.offerBlockId && set.blockIds.has(item.offerBlockId)) return true
  return false
}

export function validateProposalOptionsAgainstOrder(args: {
  options: ProposalOptionRef[]
  blocks: ProposalBlock[]
  equipment: ProposalEquipmentLine[]
  production: ProposalProductionLine[]
}): string | null {
  if (args.options.length > 6) return 'Proposal może mieć maksymalnie 6 opcji rozbudowy.'
  const seen = new Set<string>()
  for (const opt of args.options) {
    const key = opt.id || proposalOptionKey(opt.kind, opt.targetId)
    if (seen.has(key)) return 'Opcje rozbudowy nie mogą się powtarzać.'
    seen.add(key)
    if (opt.kind === 'BLOCK' && !args.blocks.some((b) => b.id === opt.targetId)) {
      return 'Wybrany blok oferty nie istnieje w zleceniu.'
    }
    if (opt.kind === 'EQUIPMENT' && !args.equipment.some((e) => e.id === opt.targetId)) {
      return 'Wybrana pozycja sprzętu nie istnieje w zleceniu.'
    }
    if (opt.kind === 'PRODUCTION' && !args.production.some((p) => p.id === opt.targetId)) {
      return 'Wybrana pozycja produkcji nie istnieje w zleceniu.'
    }
  }
  return null
}

function moneyForEquipment(items: ProposalEquipmentLine[], discountGlobal: number, vatRate: number) {
  const netBefore = round2(items.reduce((sum, i) => sum + computeProposalEquipmentNet(i), 0))
  return { netBefore, ...applyGlobalDiscountAndVat({ netBeforeGlobal: netBefore, discountGlobal, vatRate }) }
}

function moneyForProduction(items: ProposalProductionLine[], discountGlobal: number, vatRate: number) {
  const netBefore = round2(items.reduce((sum, i) => sum + computeProposalProductionNet(i), 0))
  return { netBefore, ...applyGlobalDiscountAndVat({ netBeforeGlobal: netBefore, discountGlobal, vatRate }) }
}

/**
 * Dla każdej grupy zakresu bazowego zwraca gotowy `ProposalPublicCoreItem`: nadpisanie operatora
 * (`ProposalDocumentDraft.coreItems`) scalone pole-po-polu z propozycją silnika regułowego —
 * puste pole u operatora = użyj propozycji, niepuste = użyj tego co wpisał. Cena zawsze liczona
 * z pozycji grupy (nigdy z draftu / tekstu).
 */
function buildCoreItems(args: {
  groups: ReturnType<typeof groupProposalScope>
  overrides: ProposalCoreItemOverride[]
  discountGlobal: number
  vatRate: number
}): ProposalPublicCoreItem[] {
  const overrideByGroup = new Map(args.overrides.map((o) => [o.groupId, o]))
  return args.groups.map((group) => {
    const suggestion = suggestProposalConcept(group)
    const override = overrideByGroup.get(group.id)
    const title = override?.title.trim() || suggestion.title
    const facts = override && override.facts.length > 0 ? override.facts : suggestion.facts
    const benefit = override?.benefit.trim() || suggestion.benefit
    const netBefore = round2(group.equipmentNet + group.productionNet + group.transportNet)
    const money = applyGlobalDiscountAndVat({ netBeforeGlobal: netBefore, discountGlobal: args.discountGlobal, vatRate: args.vatRate })
    return {
      id: group.id,
      title,
      facts,
      benefit,
      netAfterDiscount: money.netAfterDiscount,
      vatAmount: money.vatAmount,
      grossTotal: money.grossTotal,
    }
  })
}

export function buildProposalPublicSnapshot(args: {
  documentNumber: string
  generatedAt: string
  validityDays: number
  order: {
    name: string
    venue?: string | null
    dateFrom: string
    dateTo: string
    clientCompanyName: string
    discountGlobal: number
    vatRate: number
    currency: 'PLN' | 'EUR'
  }
  draft: ProposalDocumentDraft
  blocks: ProposalBlock[]
  equipment: ProposalEquipmentLine[]
  production: ProposalProductionLine[]
  branding: ProposalPublicSnapshot['branding']
  issuer: ProposalPublicSnapshot['issuer']
  contact: ProposalPublicSnapshot['contact']
  offer: ProposalPublicSnapshot['offer']
}): ProposalPublicSnapshot {
  const optionSet = collectOptionSet(args.draft.options)
  const discountGlobal = args.order.discountGlobal ?? 0
  const vatRate = args.order.vatRate === 0 ? 0 : 23

  const baseEq = args.equipment.filter((i) => isVisibleInOffer(i.visibleInOffer) && !isOptionEquipment(i, optionSet))
  const baseProdAll = args.production.filter((i) => isVisibleInOffer(i.visibleInOffer) && !isOptionProduction(i, optionSet))
  const baseProd = baseProdAll.filter((i) => !i.isTransport)
  const baseTransport = baseProdAll.filter((i) => i.isTransport)

  const eqMoney = moneyForEquipment(baseEq, discountGlobal, vatRate)
  const prodMoney = moneyForProduction(baseProd, discountGlobal, vatRate)
  const transportMoney = moneyForProduction(baseTransport, discountGlobal, vatRate)
  const netBefore = round2(eqMoney.netBefore + prodMoney.netBefore + transportMoney.netBefore)
  const totals = applyGlobalDiscountAndVat({ netBeforeGlobal: netBefore, discountGlobal, vatRate })

  const scopeGroups = groupProposalScope({
    blocks: args.blocks,
    equipment: args.equipment,
    production: args.production,
    excludedEquipmentIds: optionSet.equipmentIds,
    excludedProductionIds: optionSet.productionIds,
    excludedBlockIds: optionSet.blockIds,
  })
  const scope: ProposalPublicScopeGroup[] = scopeGroups.map((g) => ({
    id: g.id,
    title: g.title,
    itemNames: g.itemNames,
    equipmentNet: g.equipmentNet,
    productionNet: g.productionNet,
    transportNet: g.transportNet,
  }))
  const coreItems = buildCoreItems({
    groups: scopeGroups,
    overrides: args.draft.coreItems,
    discountGlobal,
    vatRate,
  })

  const blockById = new Map(args.blocks.map((b) => [b.id, b]))
  const options: ProposalPublicOptionCard[] = []
  for (const opt of args.draft.options) {
    let title = 'Opcja'
    let eq: ProposalEquipmentLine[] = []
    let prod: ProposalProductionLine[] = []
    if (opt.kind === 'BLOCK') {
      const block = blockById.get(opt.targetId)
      title = block?.title ?? 'Blok oferty'
      eq = args.equipment.filter((i) => i.offerBlockId === opt.targetId)
      prod = args.production.filter((i) => i.offerBlockId === opt.targetId)
    } else if (opt.kind === 'EQUIPMENT') {
      const item = args.equipment.find((i) => i.id === opt.targetId)
      title = item?.name ?? 'Sprzęt'
      if (item) eq = [item]
    } else {
      const item = args.production.find((i) => i.id === opt.targetId)
      title = item?.name ?? 'Obsługa'
      if (item) prod = [item]
    }
    const netBeforeOpt = round2(
      eq.reduce((s, i) => s + computeProposalEquipmentNet(i), 0) +
        prod.reduce((s, i) => s + computeProposalProductionNet(i), 0)
    )
    const money = applyGlobalDiscountAndVat({ netBeforeGlobal: netBeforeOpt, discountGlobal, vatRate })
    options.push({
      id: opt.id || proposalOptionKey(opt.kind, opt.targetId),
      title,
      rationale: opt.rationale.trim(),
      kind: opt.kind,
      netAfterDiscount: money.netAfterDiscount,
      vatAmount: money.vatAmount,
      grossTotal: money.grossTotal,
    })
  }

  const lead = args.draft.lead.trim() || defaultProposalLead(args.order.name)
  const expiresAt = new Date(new Date(args.generatedAt).getTime() + args.validityDays * 24 * 60 * 60 * 1000)

  return {
    documentType: 'PROPOSAL',
    documentNumber: args.documentNumber,
    generatedAt: args.generatedAt,
    expiresAt: expiresAt.toISOString(),
    validityDays: args.validityDays,
    skin: args.draft.skin,
    lead,
    whyThisSet: args.draft.whyThisSet.trim(),
    event: {
      name: args.order.name,
      venue: args.order.venue ?? null,
      dateFrom: args.order.dateFrom,
      dateTo: args.order.dateTo,
      clientCompanyName: args.order.clientCompanyName,
    },
    branding: args.branding,
    issuer: args.issuer,
    contact: args.contact,
    scope,
    coreItems,
    options,
    finance: {
      currency: args.order.currency,
      vatRate,
      discountGlobal,
      equipmentNet: eqMoney.netAfterDiscount,
      productionNet: prodMoney.netAfterDiscount,
      transportNet: transportMoney.netAfterDiscount,
      netAfterDiscount: totals.netAfterDiscount,
      vatAmount: totals.vatAmount,
      grossTotal: totals.grossTotal,
    },
    offer: args.offer,
  }
}

export function readOfferValidityDaysFromSnapshot(snapshotRaw: unknown, fallback: number): number {
  const snap = snapshotRaw && typeof snapshotRaw === 'object' ? (snapshotRaw as Record<string, unknown>) : {}
  if (typeof snap.offerValidityDays === 'number' && snap.offerValidityDays >= 1 && snap.offerValidityDays <= 180) {
    return Math.floor(snap.offerValidityDays)
  }
  const draft = snap.documentDraft
  if (draft && typeof draft === 'object') {
    const parsed = OfferDocumentDraftSchema.safeParse(draft)
    if (parsed.success) return parsed.data.offerValidityDays
  }
  return fallback >= 1 ? fallback : 14
}

export function readIssuerFromOfferSnapshot(snapshotRaw: unknown): ProposalPublicSnapshot['issuer'] | null {
  const snap = snapshotRaw && typeof snapshotRaw === 'object' ? (snapshotRaw as Record<string, unknown>) : {}
  const draft = snap.documentDraft
  if (!draft || typeof draft !== 'object') return null
  const parsed = OfferDocumentDraftSchema.safeParse(draft)
  if (!parsed.success) return null
  return {
    companyName: parsed.data.issuer.companyName,
    email: parsed.data.issuer.email,
    phone: parsed.data.issuer.phone ?? '',
  }
}

export { parseJsonSafely }
