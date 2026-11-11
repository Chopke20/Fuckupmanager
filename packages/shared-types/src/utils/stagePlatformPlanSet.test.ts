import { describe, expect, it } from 'vitest'
import { createDefaultStagePlan, fillRectWithDecks, buildStagePlan, emptyStagePlanInput, serializeStagePlan, STAGE_PLAN_LINE_MARKER } from './stagePlatformPlan'
import {
  addStagePlanScene,
  createEmptyStagePlanSet,
  formatStagePlanEquipmentDescription,
  isPrimaryStagePlanScene,
  parseStagePlanSceneIdFromDescription,
  parseStagePlanSetJson,
  removeStagePlanScene,
  serializeStagePlanSet,
  upsertStagePlanScene,
} from './stagePlatformPlanSet'

describe('stagePlatformPlanSet', () => {
  it('owija stary pojedynczy plan w zestaw z jedną sceną', () => {
    const plan = createDefaultStagePlan()
    const raw = serializeStagePlan(plan)
    const set = parseStagePlanSetJson(raw)
    expect(set.scenes).toHaveLength(1)
    expect(set.scenes[0]?.name).toBe('Scena 1')
    expect(set.scenes[0]?.plan.counts.decksTotal).toBe(plan.counts.decksTotal)
  })

  it('serializuje i wczytuje wiele scen bez utraty drugiej', () => {
    let set = createEmptyStagePlanSet()
    const a = addStagePlanScene(set, {
      name: 'Duża',
      plan: buildStagePlan({ ...emptyStagePlanInput(), decks: fillRectWithDecks(4, 2) }),
    })
    set = a.set
    const b = addStagePlanScene(set, {
      name: 'Mała',
      plan: buildStagePlan({ ...emptyStagePlanInput(), decks: fillRectWithDecks(2, 1) }),
    })
    set = b.set
    const roundTrip = parseStagePlanSetJson(serializeStagePlanSet(set))
    expect(roundTrip.scenes).toHaveLength(2)
    expect(roundTrip.scenes.map((s) => s.name)).toEqual(['Duża', 'Mała'])
    expect(roundTrip.scenes[0]?.id).toBe(a.scene.id)
    expect(roundTrip.scenes[1]?.plan.counts.decksTotal).toBe(b.scene.plan.counts.decksTotal)
  })

  it('upsert aktualizuje istniejącą scenę, remove ją usuwa', () => {
    let set = createEmptyStagePlanSet()
    const created = addStagePlanScene(set, { name: 'A' })
    set = created.set
    const bigger = buildStagePlan({ ...emptyStagePlanInput(), decks: fillRectWithDecks(6, 4) })
    set = upsertStagePlanScene(set, { sceneId: created.scene.id, plan: bigger, name: 'A+' })
    expect(set.scenes).toHaveLength(1)
    expect(set.scenes[0]?.name).toBe('A+')
    expect(set.scenes[0]?.plan.counts.decksTotal).toBe(bigger.counts.decksTotal)
    set = removeStagePlanScene(set, created.scene.id)
    expect(set.scenes).toHaveLength(0)
  })

  it('marker opisu niesie sceneId; legacy bez # zwraca null', () => {
    const desc = formatStagePlanEquipmentDescription({
      sceneId: 'scABC',
      sceneName: 'Scena 2',
      widthM: 3,
      depthM: 2,
      legHeightCm: 60,
      exactSuffix: ' · 1,5 mb',
    })
    expect(desc.startsWith(STAGE_PLAN_LINE_MARKER)).toBe(true)
    expect(parseStagePlanSceneIdFromDescription(desc)).toBe('scABC')
    expect(parseStagePlanSceneIdFromDescription(`${STAGE_PLAN_LINE_MARKER} 6×4 m, nogi 60 cm`)).toBeNull()
  })

  it('pierwsza scena jest primary (dla legacy linii)', () => {
    let set = createEmptyStagePlanSet()
    const a = addStagePlanScene(set, { name: '1' })
    set = a.set
    const b = addStagePlanScene(set, { name: '2' })
    set = b.set
    expect(isPrimaryStagePlanScene(set, a.scene.id)).toBe(true)
    expect(isPrimaryStagePlanScene(set, b.scene.id)).toBe(false)
  })
})
