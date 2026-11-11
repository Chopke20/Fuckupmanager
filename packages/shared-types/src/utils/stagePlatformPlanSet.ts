/**
 * Zestaw scen w jednym bloku / zleceniu.
 *
 * Dawniej `stagePlanJson` trzymał jeden `StagePlan`. Od wielu scen w bloku
 * trzymamy zestaw: `{ kind: 'stage-plan-set', scenes: [...] }`. Pojedynczy
 * stary plan jest wczytywany jako zestaw z jedną sceną „Scena 1”.
 */

import {
  STAGE_PLAN_LINE_MARKER,
  buildStagePlan,
  createDefaultStagePlan,
  emptyStagePlanInput,
  formatMeters,
  isStagePlan,
  migrateLegacyStagePlan,
  parseStagePlanJson,
  serializeStagePlan,
  type StagePlan,
  type StagePlanInput,
} from './stagePlatformPlan'

export const STAGE_PLAN_SET_KIND = 'stage-plan-set' as const
export const STAGE_PLAN_SET_VERSION = 1 as const

/** Prefiks identyfikatora sceny w opisie pozycji sprzętu: `[plan sceny] #abc…`. */
export const STAGE_PLAN_SCENE_ID_PREFIX = '#'

export interface StagePlanScene {
  id: string
  name: string
  plan: StagePlan
}

export interface StagePlanSet {
  kind: typeof STAGE_PLAN_SET_KIND
  version: typeof STAGE_PLAN_SET_VERSION
  scenes: StagePlanScene[]
}

let sceneIdCounter = 0

function nextSceneId(): string {
  sceneIdCounter += 1
  return `sc${Date.now().toString(36)}${sceneIdCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

export function createEmptyStagePlanSet(): StagePlanSet {
  return {
    kind: STAGE_PLAN_SET_KIND,
    version: STAGE_PLAN_SET_VERSION,
    scenes: [],
  }
}

export function defaultSceneName(index: number): string {
  return `Scena ${Math.max(1, index)}`
}

export function createStagePlanScene(params?: {
  id?: string
  name?: string
  plan?: StagePlan | null
}): StagePlanScene {
  return {
    id: params?.id?.trim() || nextSceneId(),
    name: (params?.name ?? '').trim() || defaultSceneName(1),
    plan: params?.plan ?? createDefaultStagePlan(),
  }
}

function isLegacyPlanObject(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const plan = value as { version?: unknown; tiles?: unknown }
  return plan.version === 1 && Array.isArray(plan.tiles)
}

function coercePlan(value: unknown): StagePlan | null {
  if (!value) return null
  if (typeof value === 'string') return parseStagePlanJson(value)
  if (isLegacyPlanObject(value)) return migrateLegacyStagePlan(value as any)
  if (isStagePlan(value)) {
    return buildStagePlan({
      decks: value.decks,
      stairs: Array.isArray(value.stairs) ? value.stairs : [],
      claddingMaterial: value.claddingMaterial ?? 'none',
      cladding: value.cladding ?? emptyStagePlanInput().cladding,
      floorMaterial: value.floorMaterial ?? 'none',
      railings: value.railings ?? emptyStagePlanInput().railings,
      legHeightCm: value.legHeightCm ?? 60,
      snapToGrid: value.snapToGrid ?? true,
      gridStepM: value.gridStepM ?? emptyStagePlanInput().gridStepM,
    })
  }
  if (typeof value === 'object' && Array.isArray((value as StagePlanInput).decks)) {
    const raw = value as Partial<StagePlanInput>
    return buildStagePlan({
      ...emptyStagePlanInput(),
      ...raw,
      decks: raw.decks ?? [],
      stairs: raw.stairs ?? [],
    })
  }
  return null
}

export function isStagePlanSet(value: unknown): value is StagePlanSet {
  if (!value || typeof value !== 'object') return false
  const set = value as StagePlanSet
  return set.kind === STAGE_PLAN_SET_KIND && Array.isArray(set.scenes)
}

/**
 * Wczytuje zestaw scen z JSON-a bloku/zlecenia.
 * Akceptuje: zestaw, pojedynczy plan v2, legacy v1, albo pusty/null → pusty zestaw.
 */
export function parseStagePlanSetJson(raw: string | null | undefined): StagePlanSet {
  if (!raw || !String(raw).trim()) return createEmptyStagePlanSet()
  try {
    const parsed = JSON.parse(raw) as unknown
    if (isStagePlanSet(parsed)) {
      const scenes: StagePlanScene[] = []
      for (let i = 0; i < parsed.scenes.length; i += 1) {
        const row = parsed.scenes[i]
        if (!row || typeof row !== 'object') continue
        const plan = coercePlan((row as { plan?: unknown }).plan)
        if (!plan) continue
        const id =
          typeof (row as { id?: unknown }).id === 'string' && String((row as { id: string }).id).trim()
            ? String((row as { id: string }).id).trim()
            : nextSceneId()
        const nameRaw = (row as { name?: unknown }).name
        const name =
          typeof nameRaw === 'string' && nameRaw.trim()
            ? nameRaw.trim()
            : defaultSceneName(scenes.length + 1)
        scenes.push({ id, name, plan })
      }
      return { kind: STAGE_PLAN_SET_KIND, version: STAGE_PLAN_SET_VERSION, scenes }
    }

    const single = coercePlan(parsed)
    if (single) {
      return {
        kind: STAGE_PLAN_SET_KIND,
        version: STAGE_PLAN_SET_VERSION,
        scenes: [createStagePlanScene({ name: defaultSceneName(1), plan: single })],
      }
    }
    return createEmptyStagePlanSet()
  } catch {
    return createEmptyStagePlanSet()
  }
}

/** Zapisuje zestaw — każdy plan jako input (+ bom), jak `serializeStagePlan`. */
export function serializeStagePlanSet(set: StagePlanSet): string {
  const scenes = set.scenes.map((scene, index) => {
    const planInput = JSON.parse(serializeStagePlan(scene.plan)) as Record<string, unknown>
    return {
      id: scene.id,
      name: scene.name.trim() || defaultSceneName(index + 1),
      plan: planInput,
    }
  })
  return JSON.stringify({
    kind: STAGE_PLAN_SET_KIND,
    version: STAGE_PLAN_SET_VERSION,
    scenes,
  })
}

export function findStagePlanScene(
  set: StagePlanSet,
  sceneId: string | null | undefined
): StagePlanScene | null {
  if (!sceneId) return set.scenes[0] ?? null
  return set.scenes.find((s) => s.id === sceneId) ?? null
}

export function upsertStagePlanScene(
  set: StagePlanSet,
  params: { sceneId?: string | null; name?: string; plan: StagePlan }
): StagePlanSet {
  const existing = params.sceneId
    ? set.scenes.find((s) => s.id === params.sceneId)
    : null
  if (existing) {
    return {
      ...set,
      scenes: set.scenes.map((s) =>
        s.id === existing.id
          ? {
              ...s,
              name: (params.name ?? s.name).trim() || s.name,
              plan: params.plan,
            }
          : s
      ),
    }
  }
  const scene = createStagePlanScene({
    id: params.sceneId ?? undefined,
    name: params.name ?? defaultSceneName(set.scenes.length + 1),
    plan: params.plan,
  })
  return { ...set, scenes: [...set.scenes, scene] }
}

export function addStagePlanScene(
  set: StagePlanSet,
  params?: { name?: string; plan?: StagePlan | null }
): { set: StagePlanSet; scene: StagePlanScene } {
  const scene = createStagePlanScene({
    name: params?.name ?? defaultSceneName(set.scenes.length + 1),
    plan: params?.plan ?? createDefaultStagePlan(),
  })
  return { set: { ...set, scenes: [...set.scenes, scene] }, scene }
}

export function renameStagePlanScene(
  set: StagePlanSet,
  sceneId: string,
  name: string
): StagePlanSet {
  const nextName = name.trim()
  if (!nextName) return set
  return {
    ...set,
    scenes: set.scenes.map((s) => (s.id === sceneId ? { ...s, name: nextName } : s)),
  }
}

export function removeStagePlanScene(set: StagePlanSet, sceneId: string): StagePlanSet {
  return {
    ...set,
    scenes: set.scenes.filter((s) => s.id !== sceneId),
  }
}

/** Pierwsza scena zestawu — linie legacy bez `#sceneId` należą do niej. */
export function isPrimaryStagePlanScene(
  set: StagePlanSet,
  sceneId: string | null | undefined
): boolean {
  if (!set.scenes.length) return !sceneId
  return Boolean(sceneId) && set.scenes[0]?.id === sceneId
}

/**
 * Opis pozycji sprzętu z planem sceny.
 * Format: `[plan sceny] #sceneId Nazwa · 6×4 m, nogi 60 cm · …`
 */
export function formatStagePlanEquipmentDescription(params: {
  sceneId: string
  sceneName: string
  widthM: number
  depthM: number
  legHeightCm: number
  exactSuffix?: string
}): string {
  const dim = `${params.widthM}×${params.depthM} m, nogi ${params.legHeightCm} cm`
  const name = params.sceneName.trim() || 'Scena'
  const exact = params.exactSuffix ?? ''
  return `${STAGE_PLAN_LINE_MARKER} ${STAGE_PLAN_SCENE_ID_PREFIX}${params.sceneId} ${name} · ${dim}${exact}`
}

/** Wyciąga sceneId z opisu pozycji; null = stara linia bez identyfikatora. */
export function parseStagePlanSceneIdFromDescription(
  description: string | null | undefined
): string | null {
  if (!description || !description.includes(STAGE_PLAN_LINE_MARKER)) return null
  const re = new RegExp(
    `${STAGE_PLAN_LINE_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+${STAGE_PLAN_SCENE_ID_PREFIX}([A-Za-z0-9_-]+)`
  )
  const m = re.exec(description)
  return m?.[1] ?? null
}

export function stagePlanSceneSummary(scene: StagePlanScene): string {
  const { widthM, depthM, legHeightCm, counts } = scene.plan
  return `${scene.name} · ${formatMeters(widthM)}×${formatMeters(depthM)} m · ${counts.decksTotal} pod. · ${legHeightCm} cm`
}
