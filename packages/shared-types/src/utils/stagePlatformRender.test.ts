import { describe, expect, it } from 'vitest'
import { buildStagePlan, emptyStagePlanInput, fillRectWithDecks } from './stagePlatformPlan'
import { stagePlanViewport } from './stagePlatformRender'

describe('stagePlanViewport', () => {
  it('fits landscape stage into a tall container without letterboxing waste', () => {
    const plan = buildStagePlan({
      ...emptyStagePlanInput(),
      decks: fillRectWithDecks(5, 3, true),
    })
    const vp = stagePlanViewport(plan, { widthPx: 800, heightPx: 600 })
    expect(vp.widthPx).toBe(800)
    expect(vp.heightPx).toBe(600)

    const stageW = plan.widthM * vp.scale
    const stageH = plan.depthM * vp.scale
    // Scena ma zajmować większość krótszego wymiaru (z marginesem pad).
    expect(stageW).toBeGreaterThan(800 * 0.7)
    expect(stageH).toBeGreaterThan(200)
    expect(stageW).toBeLessThanOrEqual(800)
    expect(stageH).toBeLessThanOrEqual(600)
  })

  it('keeps intrinsic height when heightPx is omitted', () => {
    const plan = buildStagePlan({
      ...emptyStagePlanInput(),
      decks: fillRectWithDecks(5, 3, true),
    })
    const vp = stagePlanViewport(plan, { widthPx: 760 })
    expect(vp.widthPx).toBe(760)
    expect(vp.heightPx).toBeGreaterThan(200)
    expect(vp.heightPx).toBeLessThan(760)
  })
})
