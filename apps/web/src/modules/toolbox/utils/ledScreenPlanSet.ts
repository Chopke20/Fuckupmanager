/**
 * Zestaw projektów LED w jednym bloku / zleceniu — lustrzanie StagePlanSet.
 * Źródło prawdy: `ledScreenJson` na order/block.
 */

import {
  emptyLedScreenProject,
  parseLedScreenProjectJson,
  serializeLedScreenProject,
  type LedScreenProjectPayload,
  type LedScreenSpec,
} from '../calculators/ledScreen'

export const LED_SCREEN_SET_KIND = 'led-screen-set' as const
export const LED_SCREEN_SET_VERSION = 1 as const
export const LED_SCREEN_LINE_MARKER = '[plan LED]'
export const LED_SCREEN_ID_PREFIX = '#'

/** Trzy role mapowania LED → sprzęt: ekran, stabilizacja, procesor. */
export const LED_SCREEN_ROLE_CONFIG_KEYS = [
  'led-screen',
  'led-stabilization',
  'led-processor',
] as const
export type LedScreenRoleConfigKey = (typeof LED_SCREEN_ROLE_CONFIG_KEYS)[number]

export const LED_SCREEN_CATALOG_KEY_LABELS: Record<string, string> = {
  'led-screen': 'Ekran LED',
  'led-stabilization': 'Stabilizacja (na m²)',
  'led-processor': 'Procesor (domyślnie 1)',
  // alias starego klucza (gdy ktoś zdążył zmapować szafki)
  'led-cabinets': 'Ekran LED',
}

export interface LedScreenSetEntry {
  id: string
  name: string
  project: LedScreenProjectPayload
}

export interface LedScreenSet {
  kind: typeof LED_SCREEN_SET_KIND
  version: typeof LED_SCREEN_SET_VERSION
  entries: LedScreenSetEntry[]
}

let entryIdCounter = 0

function nextEntryId(): string {
  entryIdCounter += 1
  return `led${Date.now().toString(36)}${entryIdCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

export function createEmptyLedScreenSet(): LedScreenSet {
  return { kind: LED_SCREEN_SET_KIND, version: LED_SCREEN_SET_VERSION, entries: [] }
}

export function defaultLedEntryName(index: number): string {
  return `Ekran ${Math.max(1, index)}`
}

export function createLedScreenSetEntry(params?: {
  id?: string
  name?: string
  project?: LedScreenProjectPayload | null
}): LedScreenSetEntry {
  return {
    id: params?.id?.trim() || nextEntryId(),
    name: (params?.name ?? '').trim() || defaultLedEntryName(1),
    project: params?.project ?? emptyLedScreenProject(),
  }
}

function cloneProject(project: LedScreenProjectPayload): LedScreenProjectPayload {
  const raw = serializeLedScreenProject(project)
  return parseLedScreenProjectJson(raw) ?? emptyLedScreenProject()
}

export function isLedScreenSet(value: unknown): value is LedScreenSet {
  if (!value || typeof value !== 'object') return false
  const set = value as LedScreenSet
  return set.kind === LED_SCREEN_SET_KIND && Array.isArray(set.entries)
}

/** Stary pojedynczy payload LED → zestaw z jednym wpisem. */
export function migrateLegacyLedProjectToSet(
  project: LedScreenProjectPayload,
  name = 'Ekran 1'
): LedScreenSet {
  return {
    kind: LED_SCREEN_SET_KIND,
    version: LED_SCREEN_SET_VERSION,
    entries: [createLedScreenSetEntry({ name, project })],
  }
}

export function parseLedScreenSetJson(raw: string | null | undefined): LedScreenSet {
  if (!raw) return createEmptyLedScreenSet()
  try {
    const parsed = JSON.parse(raw) as unknown
    if (isLedScreenSet(parsed)) {
      const entries = parsed.entries
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const project =
            parseLedScreenProjectJson(
              typeof entry.project === 'string'
                ? entry.project
                : JSON.stringify(entry.project)
            ) ?? emptyLedScreenProject()
          return createLedScreenSetEntry({
            id: typeof entry.id === 'string' ? entry.id : undefined,
            name: typeof entry.name === 'string' ? entry.name : undefined,
            project,
          })
        })
        .filter((e): e is LedScreenSetEntry => e != null)
      return { kind: LED_SCREEN_SET_KIND, version: LED_SCREEN_SET_VERSION, entries }
    }
    const legacy = parseLedScreenProjectJson(raw)
    if (legacy) return migrateLegacyLedProjectToSet(legacy)
    return createEmptyLedScreenSet()
  } catch {
    return createEmptyLedScreenSet()
  }
}

export function serializeLedScreenSet(set: LedScreenSet): string {
  return JSON.stringify({
    kind: LED_SCREEN_SET_KIND,
    version: LED_SCREEN_SET_VERSION,
    entries: set.entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      project: entry.project,
    })),
  })
}

export function findLedScreenSetEntry(
  set: LedScreenSet,
  entryId: string
): LedScreenSetEntry | null {
  return set.entries.find((e) => e.id === entryId) ?? null
}

export function upsertLedScreenSetEntry(
  set: LedScreenSet,
  params: { entryId?: string | null; name?: string; project: LedScreenProjectPayload }
): LedScreenSet {
  const existing = params.entryId
    ? set.entries.find((e) => e.id === params.entryId)
    : null
  if (existing) {
    return {
      ...set,
      entries: set.entries.map((e) =>
        e.id === existing.id
          ? {
              ...e,
              name: (params.name ?? e.name).trim() || e.name,
              project: params.project,
            }
          : e
      ),
    }
  }
  const entry = createLedScreenSetEntry({
    id: params.entryId ?? undefined,
    name: params.name ?? defaultLedEntryName(set.entries.length + 1),
    project: params.project,
  })
  return { ...set, entries: [...set.entries, entry] }
}

export function addLedScreenSetEntry(
  set: LedScreenSet,
  params?: { name?: string; project?: LedScreenProjectPayload | null }
): { set: LedScreenSet; entry: LedScreenSetEntry } {
  const entry = createLedScreenSetEntry({
    name: params?.name ?? defaultLedEntryName(set.entries.length + 1),
    project: params?.project ?? emptyLedScreenProject(),
  })
  return { set: { ...set, entries: [...set.entries, entry] }, entry }
}

export function renameLedScreenSetEntry(
  set: LedScreenSet,
  entryId: string,
  name: string
): LedScreenSet {
  const nextName = name.trim()
  if (!nextName) return set
  return {
    ...set,
    entries: set.entries.map((e) => (e.id === entryId ? { ...e, name: nextName } : e)),
  }
}

export function removeLedScreenSetEntry(set: LedScreenSet, entryId: string): LedScreenSet {
  return { ...set, entries: set.entries.filter((e) => e.id !== entryId) }
}

export function duplicateLedScreenSetEntry(
  set: LedScreenSet,
  entryId: string
): { set: LedScreenSet; entry: LedScreenSetEntry } | null {
  const source = set.entries.find((e) => e.id === entryId)
  if (!source) return null
  const baseName = source.name.replace(/\s*\(kopia(?:\s+\d+)?\)\s*$/i, '').trim() || source.name
  const existingNames = new Set(set.entries.map((e) => e.name))
  let name = `${baseName} (kopia)`
  let n = 2
  while (existingNames.has(name)) {
    name = `${baseName} (kopia ${n})`
    n += 1
  }
  const entry = createLedScreenSetEntry({
    name,
    project: cloneProject(source.project),
  })
  return { set: { ...set, entries: [...set.entries, entry] }, entry }
}

export function ledScreenCabinetsTotal(project: LedScreenProjectPayload): number {
  return project.screens.reduce((acc, screen) => acc + screen.columns * screen.rows, 0)
}

/** Powierzchnia wszystkich ekranów w m² (szer. × wys. szafek). */
export function ledScreenAreaM2(project: LedScreenProjectPayload): number {
  const area = project.screens.reduce((acc, screen) => {
    const wM = (screen.columns * screen.cabinetWidthMm) / 1000
    const hM = (screen.rows * screen.cabinetHeightMm) / 1000
    return acc + wM * hM
  }, 0)
  return Math.round(area * 100) / 100
}

export function ledScreenEntrySummary(entry: LedScreenSetEntry): string {
  const cabinets = ledScreenCabinetsTotal(entry.project)
  const screens = entry.project.screens.length
  return `${entry.name} · ${screens} ekr. · ${cabinets} szaf.`
}

export function formatLedScreenEquipmentDescription(params: {
  entryId: string
  entryName: string
  cabinetsTotal: number
  screensCount: number
  exactSuffix?: string
}): string {
  const name = params.entryName.trim() || 'Ekran'
  const dim = `${params.screensCount} ekr., ${params.cabinetsTotal} szaf.`
  const exact = params.exactSuffix ?? ''
  return `${LED_SCREEN_LINE_MARKER} ${LED_SCREEN_ID_PREFIX}${params.entryId} ${name} · ${dim}${exact}`
}

export function parseLedScreenEntryIdFromDescription(
  description: string | null | undefined
): string | null {
  if (!description || !description.includes(LED_SCREEN_LINE_MARKER)) return null
  const re = new RegExp(
    `${LED_SCREEN_LINE_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+${LED_SCREEN_ID_PREFIX}([A-Za-z0-9_-]+)`
  )
  const m = re.exec(description)
  return m?.[1] ?? null
}

export function ledScreenBomLines(project: LedScreenProjectPayload): Array<{
  key: string
  catalogKey: string
  name: string
  quantity: number
  unit: 'szt.'
}> {
  const cabinets = ledScreenCabinetsTotal(project)
  const areaM2 = ledScreenAreaM2(project)
  const screens = project.screens.length
  if (cabinets <= 0 && screens <= 0) return []
  const lines: Array<{
    key: string
    catalogKey: string
    name: string
    quantity: number
    unit: 'szt.'
  }> = []
  if (cabinets > 0) {
    lines.push({
      key: 'led-screen',
      catalogKey: 'led-screen',
      name: 'Ekran LED',
      quantity: cabinets,
      unit: 'szt.',
    })
  }
  // Stabilizacja: 1 szt. na każdy m² powierzchni ekranów (zaokrąglone w górę).
  const stabilizationQty = Math.max(1, Math.ceil(areaM2))
  if (areaM2 > 0) {
    lines.push({
      key: 'led-stabilization',
      catalogKey: 'led-stabilization',
      name: 'Stabilizacja',
      quantity: stabilizationQty,
      unit: 'szt.',
    })
  }
  // Procesor: domyślnie 1 — ilość poprawiasz ręcznie w wykazie.
  if (screens > 0) {
    lines.push({
      key: 'led-processor',
      catalogKey: 'led-processor',
      name: 'Procesor',
      quantity: 1,
      unit: 'szt.',
    })
  }
  return lines
}

export function summarizeLedScreens(screens: LedScreenSpec[]): string {
  return screens.map((s) => `${s.label} ${s.columns}×${s.rows}`).join(', ')
}
