import type { ProposalCoreItemOverride } from '../schemas/order-document.schema'
import type { ProposalScopeGroup } from './proposalScope'

/**
 * Silnik "maszynowego ubierania oferty w koncept sprzedażowy" — patrz brief `lama-proposal-online.mdc`.
 *
 * To jest wariant regułowy (deterministyczny, bez sieci, bez kosztów): z surowych pozycji danej
 * grupy zakresu bazowego (blok oferty) wyciąga 2-5 konkretnych faktów ("12 mikrofonów", "8 kolumn
 * nagłośnieniowych") i dobiera jedno zdanie korzyści po polsku. Liczby pochodzą wyłącznie z
 * pozycji zlecenia — silnik nigdy nie zgaduje cen/ilości, tylko zlicza i formatuje istniejące dane.
 *
 * Punkt rozszerzenia pod "prawdziwe AI": backend ma już wdrożoną integrację OpenRouter
 * (`apps/api/src/modules/ai/ai.controller.ts`, `generateOfferClientDescription` i siostrzane
 * funkcje) do generowania/poprawiania tekstu w tym samym stylu. `suggestProposalConcept()` poniżej
 * jest tym, co wypełnia pola natychmiast (bez sieci) — operator może to zostawić, ręcznie
 * poprawić, albo wysłać do endpointu AI (`/api/ai/proposal-concept`) żeby dostać wersję
 * "polerowaną" LLM-em na bazie tych samych faktów. Efekt zawsze trafia do draftu jako zwykły
 * tekst (`ProposalCoreItemOverride`) i wymaga zapisania draftu przez operatora przed publikacją —
 * nic nie publikuje się "na ślepo" z samego wygenerowania.
 */

export const PROPOSAL_CONCEPT_CATEGORIES = [
  'AUDIO',
  'LIGHT',
  'STAGE',
  'MULTIMEDIA',
  'PRODUCTION',
  'POWER',
  'GENERIC',
] as const

export type ProposalConceptCategory = (typeof PROPOSAL_CONCEPT_CATEGORIES)[number]

const CATEGORY_PATTERNS: Array<[ProposalConceptCategory, RegExp]> = [
  ['AUDIO', /nagłośni|audio|dźwięk|sound/i],
  ['LIGHT', /światł|oświetlen|\blight/i],
  ['STAGE', /\bscen[ayę]\b|podest|trybun|\bstage\b/i],
  ['MULTIMEDIA', /multimedi|ekran|led ?wall|telebim|projekc|wizj/i],
  ['POWER', /zasilani|energetyk|agregat|\bpower\b/i],
  ['PRODUCTION', /produkcj|obsług|technic|kierowni|\bcrew\b/i],
]

/** Rozpoznaje kategorię koncepcyjną grupy po tytule bloku, a w drugiej kolejności po kategoriach pozycji sprzętu w grupie. */
export function detectProposalConceptCategory(group: Pick<ProposalScopeGroup, 'title' | 'equipmentDetails'>): ProposalConceptCategory {
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(group.title)) return category
  }
  const weight = new Map<ProposalConceptCategory, number>()
  for (const detail of group.equipmentDetails) {
    if (!detail.category) continue
    for (const [category, pattern] of CATEGORY_PATTERNS) {
      if (pattern.test(detail.category)) {
        weight.set(category, (weight.get(category) ?? 0) + detail.quantity)
      }
    }
  }
  let best: ProposalConceptCategory = 'GENERIC'
  let bestWeight = 0
  for (const [category, w] of weight) {
    if (w > bestWeight) {
      best = category
      bestWeight = w
    }
  }
  return best
}

type FactRule = {
  pattern: RegExp
  source: 'equipment' | 'production'
  label: (count: number) => string
}

const FACT_RULES: Record<Exclude<ProposalConceptCategory, 'GENERIC'>, FactRule[]> = {
  AUDIO: [
    { pattern: /mikrofon/i, source: 'equipment', label: (n) => `${n} ${polishCount(n, 'mikrofon', 'mikrofony', 'mikrofonów')}` },
    {
      pattern: /kolumn|line ?array|głośnik|subwoofer|\bsub\b/i,
      source: 'equipment',
      label: (n) => `${n} ${polishCount(n, 'kolumna nagłośnieniowa', 'kolumny nagłośnieniowe', 'kolumn nagłośnieniowych')}`,
    },
    { pattern: /mikser|konsolet/i, source: 'equipment', label: () => 'cyfrowa konsoleta miksująca' },
    { pattern: /monitor.{0,3}odsłuch|odsłuch/i, source: 'equipment', label: (n) => `${n} ${polishCount(n, 'monitor odsłuchowy', 'monitory odsłuchowe', 'monitorów odsłuchowych')}` },
    { pattern: /bezprzewodow|wireless|in-?ear/i, source: 'equipment', label: () => 'bezprzewodowy system audio' },
  ],
  LIGHT: [
    { pattern: /ruchom.{0,3}głow|moving head/i, source: 'equipment', label: (n) => `${n} ${polishCount(n, 'ruchoma głowica światła', 'ruchome głowice światła', 'ruchomych głowic światła')}` },
    { pattern: /par led|\bwash\b|\bbeam\b|reflektor/i, source: 'equipment', label: (n) => `${n} ${polishCount(n, 'reflektor LED', 'reflektory LED', 'reflektorów LED')}` },
    { pattern: /konsolet|sterownik.{0,3}świat|grandma|avolites/i, source: 'equipment', label: () => 'profesjonalna konsoleta świateł' },
    { pattern: /trus|rigging|kratownic/i, source: 'equipment', label: () => 'konstrukcja rigging pod oświetlenie' },
  ],
  STAGE: [
    { pattern: /podest|platform/i, source: 'equipment', label: (n) => `${n} ${polishCount(n, 'element konstrukcji sceny', 'elementy konstrukcji sceny', 'elementów konstrukcji sceny')}` },
    { pattern: /dach|zadaszen|roof/i, source: 'equipment', label: () => 'zadaszenie sceniczne' },
    { pattern: /schod|rampa/i, source: 'equipment', label: () => 'bezpieczne wejście na scenę' },
    { pattern: /barierk|ogrodzeni/i, source: 'equipment', label: () => 'barierki zabezpieczające' },
  ],
  MULTIMEDIA: [
    { pattern: /led ?wall|telebim/i, source: 'equipment', label: (n) => `${n} ${polishCount(n, 'ekran LED', 'ekrany LED', 'ekranów LED')}` },
    { pattern: /ekran|monitor(?!.{0,3}odsłuch)/i, source: 'equipment', label: (n) => `${n} ${polishCount(n, 'ekran', 'ekrany', 'ekranów')}` },
    { pattern: /projektor/i, source: 'equipment', label: (n) => `${n} ${polishCount(n, 'projektor', 'projektory', 'projektorów')}` },
    { pattern: /kamer|realizacj.{0,3}wizj|\bvision\b/i, source: 'equipment', label: () => 'realizacja wizji na żywo' },
  ],
  PRODUCTION: [
    { pattern: /kierowni.{0,3}produkcj|stage manager/i, source: 'production', label: () => 'kierownik produkcji na miejscu' },
    { pattern: /technik|operator|realizator/i, source: 'production', label: (n) => `${n} ${polishCount(n, 'osoba obsługi technicznej', 'osoby obsługi technicznej', 'osób obsługi technicznej')}` },
  ],
  POWER: [
    { pattern: /agregat/i, source: 'equipment', label: (n) => `${n} ${polishCount(n, 'agregat prądotwórczy', 'agregaty prądotwórcze', 'agregatów prądotwórczych')}` },
    { pattern: /rozdzielni/i, source: 'equipment', label: () => 'zabezpieczona rozdzielnia zasilania' },
  ],
}

const BENEFIT_TEMPLATES: Record<ProposalConceptCategory, string> = {
  AUDIO: 'Czysty, pełny dźwięk w każdym miejscu sali — bez przesterów i martwych stref.',
  LIGHT: 'Światło, które buduje nastrój i podkreśla scenę przez cały czas trwania wydarzenia.',
  STAGE: 'Stabilna, bezpieczna scena dopasowana do programu — gotowa pod prowadzących i występy.',
  MULTIMEDIA: 'Czytelny przekaz obrazu dla każdego uczestnika, widoczny z każdego miejsca na sali.',
  PRODUCTION: 'Doświadczona ekipa na miejscu pilnuje realizacji zgodnie z planem, bez angażowania Waszego zespołu.',
  POWER: 'Stabilne, zabezpieczone zasilanie dla całej produkcji — bez ryzyka przerw w trakcie wydarzenia.',
  GENERIC: 'Zakres dobrany pod charakter wydarzenia — pełna specyfikacja w ofercie.',
}

function polishCount(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one
  const lastDigit = n % 10
  const lastTwo = n % 100
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few
  return many
}

/** Zlicza łączną ilość pozycji danego źródła w grupie pasujących do wzorca (suma `quantity`/`units`, nie liczba linii). */
function countBySource(group: Pick<ProposalScopeGroup, 'equipmentDetails' | 'productionDetails'>, rule: FactRule): number {
  const items = rule.source === 'equipment' ? group.equipmentDetails : group.productionDetails
  let total = 0
  for (const item of items) {
    if (rule.pattern.test(item.name)) {
      total += rule.source === 'equipment' ? (item as { quantity: number }).quantity : (item as { units: number }).units
    }
  }
  return total
}

/** Fallback gdy żadna reguła kategorii nie trafiła w nazwy: bierze do 3 najliczniejszych pozycji z grupy. */
function genericFacts(group: Pick<ProposalScopeGroup, 'equipmentDetails' | 'productionDetails'>): string[] {
  const merged = [
    ...group.equipmentDetails.map((d) => ({ name: d.name, count: d.quantity })),
    ...group.productionDetails.map((d) => ({ name: d.name, count: d.units })),
  ].sort((a, b) => b.count - a.count)
  const facts: string[] = []
  for (const item of merged) {
    if (facts.length >= 3) break
    facts.push(item.count > 1 ? `${item.count}× ${item.name}` : item.name)
  }
  return facts
}

/** Generuje 2-5 konkretnych faktów dla grupy w danej kategorii (liczby zawsze z pozycji zlecenia). */
export function generateProposalConceptFacts(
  category: ProposalConceptCategory,
  group: Pick<ProposalScopeGroup, 'equipmentDetails' | 'productionDetails'>
): string[] {
  if (category === 'GENERIC') return genericFacts(group)
  const facts: string[] = []
  for (const rule of FACT_RULES[category]) {
    const count = countBySource(group, rule)
    if (count > 0) facts.push(rule.label(count))
    if (facts.length >= 5) break
  }
  if (facts.length < 2) {
    for (const fact of genericFacts(group)) {
      if (facts.length >= 5) break
      if (!facts.includes(fact)) facts.push(fact)
    }
  }
  return facts.slice(0, 5)
}

export function generateProposalConceptBenefit(category: ProposalConceptCategory): string {
  return BENEFIT_TEMPLATES[category]
}

/**
 * Punkt wejścia silnika regułowego: z grupy zakresu bazowego buduje gotowy do zapisania
 * `ProposalCoreItemOverride` (operator go zobaczy w edytorze i może dowolnie poprawić przed
 * zapisaniem draftu / publikacją).
 */
export function suggestProposalConcept(group: ProposalScopeGroup): ProposalCoreItemOverride {
  const category = detectProposalConceptCategory(group)
  return {
    groupId: group.id,
    title: group.title,
    facts: generateProposalConceptFacts(category, group),
    benefit: generateProposalConceptBenefit(category),
  }
}
