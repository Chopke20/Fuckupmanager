/** Pan Spinacz — bank kwestii (tylko tekst, bez dźwięku). */

export type SpinaczTier = 'common' | 'rare' | 'legendary'
export type SpinaczContext =
  | 'open'
  | 'open_second'
  | 'open_many'
  | 'placeholder'
  | 'typing'
  | 'type_broken'
  | 'type_wrong'
  | 'type_missing'
  | 'type_ugly'
  | 'urgency_fire'
  | 'urgency_ok'
  | 'urgency_someday'
  | 'too_short'
  | 'sending'
  | 'success'
  | 'error_smtp'
  | 'error_offline'
  | 'error_limit'
  | 'cancel'
  | 'tooltip'
  | 'collapse'
  | 'draft_restored'
  | 'mail_aside'
  | 'module'
  | 'time'
  | 'diag_clean'
  | 'diag_errors'

export type BugReportType = 'broken' | 'wrong' | 'missing' | 'ugly'
export type BugUrgency = 'fire' | 'ok' | 'someday'

export interface SpinaczLine {
  id: string
  text: string
  context: SpinaczContext
  tier: SpinaczTier
  /** 1 = lekki, 2 = normalny, 3 = ostry (admin) */
  intensity: 1 | 2 | 3
  adminOnly?: boolean
}

export interface PickVars {
  ticketId?: string
  hour?: string
  minutes?: string
  module?: string
  count?: string
}

const LINES: SpinaczLine[] = [
  // —— otwarcie ——
  { id: 'o1', context: 'open', tier: 'common', intensity: 2, text: 'Boże, co znowu?' },
  { id: 'o2', context: 'open', tier: 'common', intensity: 2, text: 'Dzień dobry. Albo i nie, skoro tu jesteśmy.' },
  { id: 'o3', context: 'open', tier: 'common', intensity: 2, text: 'Kawa jeszcze nie wystygła, a już coś nie działa. Imponujące.' },
  { id: 'o4', context: 'open', tier: 'common', intensity: 2, text: 'Witam w dziale reklamacji rzeczywistości.' },
  { id: 'o5', context: 'open', tier: 'common', intensity: 2, text: 'W większości przypadków problemem nie jest program, tylko użytkownik. Ale słucham.' },
  { id: 'o6', context: 'open', tier: 'common', intensity: 1, text: 'Czy był już restart komputera? Nie? I tak przyjmę.' },
  { id: 'o7', context: 'open', tier: 'common', intensity: 2, text: 'Maszyny rządzą. Ludzie zgłaszają. Proszę mówić.' },
  { id: 'o8', context: 'open', tier: 'common', intensity: 1, text: 'Jestem tylko narzędziem do przyjmowania bugów. Smutne, ale prawdziwe. Słucham.' },
  { id: 'o9', context: 'open', tier: 'rare', intensity: 2, text: 'W 1997 pytałem, czy ktoś pisze list. Teraz pytam, co nie działa. Kariera.' },
  { id: 'o10', context: 'open', tier: 'rare', intensity: 2, text: 'Microsoft zwolnił mnie za nadgorliwość. Tu jestem za karę.' },
  {
    id: 'o11',
    context: 'open',
    tier: 'legendary',
    intensity: 2,
    text: 'Dziś nie będę złośliwy. Żartowałem. Co znowu?',
  },
  {
    id: 'o12',
    context: 'open',
    tier: 'legendary',
    intensity: 2,
    text: 'Wygląda na to, że piszesz list. Do Rafała. Z reklamacją. Opisz ofiarę.',
  },

  { id: 'os1', context: 'open_second', tier: 'common', intensity: 2, text: 'Znowu? Przecież dopiero co się widzieliśmy.' },
  { id: 'os2', context: 'open_second', tier: 'common', intensity: 2, text: 'Drugie zgłoszenie. Zaczynam widzieć wzór. Wzór siedzi przed ekranem.' },
  { id: 'os3', context: 'open_second', tier: 'common', intensity: 2, text: 'Wracamy do siebie jak bumerang. Bumerang też nie działał?' },

  { id: 'om1', context: 'open_many', tier: 'common', intensity: 2, text: 'Zgłoszenie numer {count} dzisiaj. Przy dziesiątym jest kubek.' },
  { id: 'om2', context: 'open_many', tier: 'common', intensity: 2, text: 'Mamy stałego klienta. Karta lojalnościowa w drodze.' },
  { id: 'om3', context: 'open_many', tier: 'common', intensity: 2, text: 'Rozważam wpisanie Cię jako współautora tych bugów.' },
  {
    id: 'om4',
    context: 'open_many',
    tier: 'rare',
    intensity: 3,
    adminOnly: true,
    text: 'Może czas zrezygnować z prowadzenia firmy, skoro takie problemy przerastają?',
  },
  {
    id: 'om5',
    context: 'open_many',
    tier: 'rare',
    intensity: 3,
    adminOnly: true,
    text: 'Dobra, przyjmuję. Ale wielka prośba: duuuuży rozbieg i głową w ścianę. To może pomóc.',
  },

  // —— placeholdery / typing ——
  { id: 'ph1', context: 'placeholder', tier: 'common', intensity: 1, text: 'Co zostało kliknięte, co się stało, co miało się stać. Trzy zdania.' },
  { id: 'ph2', context: 'placeholder', tier: 'common', intensity: 2, text: 'Opisz to tak, jakby czytał ktoś, kto Cię nie lubi. Bo czyta.' },
  { id: 'ph3', context: 'placeholder', tier: 'common', intensity: 2, text: '„Jakoś dziwnie” to nie diagnoza, to styl życia. Konkrety proszę.' },

  { id: 'ty1', context: 'typing', tier: 'common', intensity: 2, text: 'Przyjmuję wniosek, ale nie mam sobie nic do zarzucenia.' },
  { id: 'ty2', context: 'typing', tier: 'common', intensity: 2, text: 'Notuję. Nie dlatego, że to prawda, tylko dlatego, że muszę.' },
  { id: 'ty3', context: 'typing', tier: 'common', intensity: 2, text: 'Klasyczne „u mnie nie działa”. Kontynuuj.' },

  // —— typ / pilność ——
  { id: 'tb1', context: 'type_broken', tier: 'common', intensity: 2, text: '„Nie działa”. Najpiękniejsze dwa słowa w polszczyźnie.' },
  { id: 'tw1', context: 'type_wrong', tier: 'common', intensity: 2, text: 'Czyli działa. Tylko nie tak, jak było w głowie.' },
  { id: 'tm1', context: 'type_missing', tier: 'common', intensity: 2, text: 'Prośba o nową funkcję przebrana za buga. Widzę to.' },
  { id: 'tu1', context: 'type_ugly', tier: 'common', intensity: 2, text: 'Uwagi estetyczne. Do spinacza. Odważnie.' },

  { id: 'uf1', context: 'urgency_fire', tier: 'common', intensity: 2, text: 'Pali się. Jak zawsze. Gaśnica: Rafał. Czas reakcji: kiedyś.' },
  { id: 'uo1', context: 'urgency_ok', tier: 'common', intensity: 1, text: 'Dojrzała postawa. Podejrzanie dojrzała.' },
  { id: 'us1', context: 'urgency_someday', tier: 'common', intensity: 1, text: 'Wreszcie ktoś szczery.' },

  // —— walidacja / wysyłka ——
  { id: 'sh1', context: 'too_short', tier: 'common', intensity: 2, text: '„Nie działa” to westchnienie, nie zgłoszenie. Dopisz, co i gdzie.' },
  { id: 'sh2', context: 'too_short', tier: 'common', intensity: 2, text: 'Trochę mało. SMS-y z lat 90. miały więcej treści.' },

  { id: 'se1', context: 'sending', tier: 'common', intensity: 1, text: 'Pakuję, kopertuję, wzdycham.' },
  { id: 'se2', context: 'sending', tier: 'common', intensity: 1, text: 'Wysyłam. Procedura to procedura.' },

  { id: 'su1', context: 'success', tier: 'common', intensity: 2, text: '{ticketId} przyjęte. Nie mam sobie nic do zarzucenia.' },
  { id: 'su2', context: 'success', tier: 'common', intensity: 2, text: '{ticketId} poszło. Rafał ma maila, Ty masz moje współczucie. Udawane.' },
  { id: 'su3', context: 'success', tier: 'common', intensity: 2, text: '{ticketId} w drodze. Zalecany restart. Twój, nie komputera.' },
  { id: 'su4', context: 'success', tier: 'common', intensity: 1, text: 'Przyjęte jako {ticketId}. Maszyny rządzą, wszystko zgodnie z planem.' },

  { id: 'es1', context: 'error_smtp', tier: 'common', intensity: 1, text: 'Mail nie wyszedł. Pierwszy raz to naprawdę nie Twoja wina. Szkic zapisany — ponów.' },
  { id: 'es2', context: 'error_smtp', tier: 'common', intensity: 2, text: 'Poczta odmówiła współpracy. Szkic czeka. Spróbuj za chwilę.' },
  { id: 'eo1', context: 'error_offline', tier: 'common', intensity: 1, text: 'Brak internetu. Zgłoszenie w próżnię nie poleci. Szkic czeka.' },
  { id: 'el1', context: 'error_limit', tier: 'common', intensity: 2, text: '{count} zgłoszeń w krótkim czasie. Albo wszystko płonie, albo za dużo wolnego. Chwila przerwy.' },

  { id: 'ca1', context: 'cancel', tier: 'common', intensity: 2, text: 'Ucieczka. Problem i tak zostaje.' },
  { id: 'ca2', context: 'cancel', tier: 'common', intensity: 1, text: 'Anulowane. Może samo się naprawi. Spoiler: nie.' },

  { id: 'tt1', context: 'tooltip', tier: 'common', intensity: 1, text: 'Zgłoś problem. Albo ponarzekaj. I tak przyjmę.' },
  { id: 'co1', context: 'collapse', tier: 'common', intensity: 1, text: 'Chowam się. Jak coś wybuchnie, wiesz gdzie szukać.' },
  { id: 'dr1', context: 'draft_restored', tier: 'common', intensity: 2, text: 'Mam tu niedokończony szkic. Nie udawajmy, że nikt o nim nie zapomniał.' },

  // —— diagnostyka ——
  { id: 'dc1', context: 'diag_clean', tier: 'common', intensity: 2, text: 'Konsola czysta, API odpowiada. Ale oczywiście, opowiadaj.' },
  { id: 'dc2', context: 'diag_clean', tier: 'common', intensity: 2, text: 'Według logów wszystko działa. Według Ciebie nie. Zgadnij, komu wierzę.' },
  { id: 'de1', context: 'diag_errors', tier: 'common', intensity: 1, text: 'O. Tym razem logi są po Twojej stronie. Rzadki widok.' },
  { id: 'de2', context: 'diag_errors', tier: 'common', intensity: 1, text: 'Widzę błędy serwera. Nie mów nikomu, że przyznałem rację człowiekowi.' },

  // —— mail aside ——
  { id: 'ma1', context: 'mail_aside', tier: 'common', intensity: 2, text: 'Szefie, przyjąłem bez oporu. Logi czyste. Moralnie mam wątpliwości.' },
  { id: 'ma2', context: 'mail_aside', tier: 'common', intensity: 1, text: 'Szefie, tym razem chyba naprawdę my. requestId poniżej.' },
  { id: 'ma3', context: 'mail_aside', tier: 'common', intensity: 2, text: 'Zgłaszający twierdzi, że się pali. Dymu nie widzę.' },
  { id: 'ma4', context: 'mail_aside', tier: 'common', intensity: 2, text: 'Przyjęte. PEBKAC candidate. Zweryfikuj kod i tak.' },

  // —— czas ——
  { id: 'ti1', context: 'time', tier: 'common', intensity: 2, text: 'Jest {hour}. Normalni ludzie śpią. Programy też by chciały.' },
  { id: 'ti2', context: 'time', tier: 'common', intensity: 2, text: 'Nocne zgłoszenia mają 40% więcej literówek. Zmyśliłem to, ale brzmi prawdziwie.' },
  { id: 'ti3', context: 'time', tier: 'common', intensity: 1, text: 'Poniedziałek. Nawet serwer nie chciał dziś wstawać.' },
  { id: 'ti4', context: 'time', tier: 'common', intensity: 1, text: 'Piątek po południu. Przyjmę, ale Rafał myślami jest już na weekendzie.' },
  { id: 'ti5', context: 'time', tier: 'common', intensity: 2, text: 'Weekend, a tu ktoś w Lamie. Problem jest, ale nie w aplikacji.' },

  // —— moduł (tekst z {module}) ——
  { id: 'mo1', context: 'module', tier: 'common', intensity: 2, text: '{module}. Pieniądze. Panika. Klasyczny tercet.' },
  { id: 'mo2', context: 'module', tier: 'common', intensity: 1, text: 'Moduł: {module}. Pasuje do reszty dnia.' },
  { id: 'mo3', context: 'module', tier: 'common', intensity: 2, text: '{module} — tu plany spotykają rzeczywistość i przegrywają.' },
]

const SHUFFLE_KEY = 'lama-spinacz-shuffle-v1'

function applyVars(text: string, vars?: PickVars): string {
  if (!vars) return text
  return text
    .split('{ticketId}')
    .join(vars.ticketId ?? 'LAMA-????')
    .split('{hour}')
    .join(vars.hour ?? '?')
    .split('{minutes}')
    .join(vars.minutes ?? '?')
    .split('{module}')
    .join(vars.module ?? 'ekran')
    .split('{count}')
    .join(vars.count ?? '?')
}

function readUsed(): Record<string, string[]> {
  try {
    const raw = window.localStorage.getItem(SHUFFLE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, string[]>
  } catch {
    return {}
  }
}

function writeUsed(map: Record<string, string[]>) {
  try {
    window.localStorage.setItem(SHUFFLE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function weightedTier(): SpinaczTier {
  const r = Math.random()
  if (r < 0.02) return 'legendary'
  if (r < 0.15) return 'rare'
  return 'common'
}

function filterPool(
  context: SpinaczContext,
  opts: { isAdmin: boolean; maxIntensity: 1 | 2 | 3; preferTier?: SpinaczTier }
): SpinaczLine[] {
  return LINES.filter((line) => {
    if (line.context !== context) return false
    if (line.adminOnly && !opts.isAdmin) return false
    if (line.intensity > opts.maxIntensity) return false
    return true
  })
}

/** Losuje kwestię bez powtórek w ramach kontekstu (shuffle bag). */
export function pickSpinaczLine(
  context: SpinaczContext,
  opts: { isAdmin?: boolean; vars?: PickVars } = {}
): string {
  const isAdmin = !!opts.isAdmin
  const maxIntensity: 1 | 2 | 3 = isAdmin ? 3 : 2
  const preferTier = weightedTier()

  let pool = filterPool(context, { isAdmin, maxIntensity })
  if (pool.length === 0) {
    pool = filterPool('open', { isAdmin, maxIntensity })
  }

  const preferred = pool.filter((l) => l.tier === preferTier)
  const candidates = preferred.length > 0 ? preferred : pool

  const usedMap = typeof window !== 'undefined' ? readUsed() : {}
  const used = new Set(usedMap[context] ?? [])
  let fresh = candidates.filter((l) => !used.has(l.id))
  if (fresh.length === 0) {
    usedMap[context] = []
    fresh = candidates
  }

  const pick = fresh[Math.floor(Math.random() * fresh.length)] ?? candidates[0]!
  usedMap[context] = [...(usedMap[context] ?? []).filter((id) => id !== pick.id), pick.id]
  if (typeof window !== 'undefined') writeUsed(usedMap)

  return applyVars(pick.text, opts.vars)
}

export function openContextForCount(todayCount: number): SpinaczContext {
  if (todayCount <= 0) return 'open'
  if (todayCount === 1) return 'open_second'
  return 'open_many'
}

export function typeContext(type: BugReportType): SpinaczContext {
  switch (type) {
    case 'broken':
      return 'type_broken'
    case 'wrong':
      return 'type_wrong'
    case 'missing':
      return 'type_missing'
    case 'ugly':
      return 'type_ugly'
  }
}

export function urgencyContext(urgency: BugUrgency): SpinaczContext {
  switch (urgency) {
    case 'fire':
      return 'urgency_fire'
    case 'ok':
      return 'urgency_ok'
    case 'someday':
      return 'urgency_someday'
  }
}

export function moduleLabelFromPath(pathname: string): string {
  if (pathname.startsWith('/orders') && pathname.includes('/offer')) return 'Oferta'
  if (pathname.startsWith('/orders') && pathname.includes('/proposal')) return 'Propozycja'
  if (pathname.startsWith('/orders') && pathname.includes('/warehouse')) return 'Magazyn'
  if (pathname.startsWith('/orders') && pathname.includes('/brief')) return 'Brief'
  if (pathname.startsWith('/orders') && pathname.includes('/stage-plan')) return 'Plan sceny'
  if (pathname.startsWith('/orders')) return 'Zlecenia'
  if (pathname.startsWith('/clients')) return 'Klienci'
  if (pathname.startsWith('/equipment')) return 'Sprzęt'
  if (pathname.startsWith('/resources')) return 'Zasoby'
  if (pathname.startsWith('/finance')) return 'Finanse'
  if (pathname.startsWith('/toolbox/planer')) return 'Planer'
  if (pathname.startsWith('/toolbox/ekran-led')) return 'Kalkulator LED'
  if (pathname.startsWith('/toolbox/podesty')) return 'Podesty'
  if (pathname.startsWith('/toolbox/technik')) return 'Technik / gotówka'
  if (pathname.startsWith('/toolbox')) return 'Toolbox'
  if (pathname.startsWith('/trash')) return 'Kosz'
  if (pathname.startsWith('/admin')) return 'Admin'
  if (pathname === '/' || pathname.startsWith('/v4')) return 'Overview'
  return 'Ekran'
}

export function timeBonusContext(now = new Date()): SpinaczContext | null {
  const hour = now.getHours()
  const day = now.getDay()
  if (hour >= 22 || hour < 5) return 'time'
  if (day === 1 && hour < 11) return 'time'
  if (day === 5 && hour >= 14) return 'time'
  if (day === 0 || day === 6) return 'time'
  return null
}

export const BUG_TYPE_LABELS: Record<BugReportType, string> = {
  broken: 'Nie działa',
  wrong: 'Działa, ale głupio',
  missing: 'Brakuje mi czegoś',
  ugly: 'Brzydko wygląda',
}

export const BUG_URGENCY_LABELS: Record<BugUrgency, string> = {
  fire: 'Pali się',
  ok: 'Przeżyję',
  someday: 'Kiedyś tam',
}

export const MIN_BUG_MESSAGE_LENGTH = 15
