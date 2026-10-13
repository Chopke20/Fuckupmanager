import { describe, expect, it } from 'vitest'
import {
  addDaysIso,
  clampBlockToDay,
  emptyPlannerBoard,
  layoutOverlappingBlocks,
  normalizePlannerBoard,
  parsePlannerBoardJson,
  serializePlannerBoard,
  snapMinutes,
  type PlannerBlock,
} from './plannerTypes'

describe('plannerTypes', () => {
  it('snaps minutes to grid', () => {
    expect(snapMinutes(7, 15)).toBe(0)
    expect(snapMinutes(8, 15)).toBe(15)
    expect(snapMinutes(22, 15)).toBe(15)
    expect(snapMinutes(23, 15)).toBe(30)
  })

  it('clamps block into visible day window', () => {
    const time = { startHour: 6, endHour: 24, snapMinutes: 15 }
    expect(clampBlockToDay(5 * 60, 7 * 60, time)).toEqual({ startMin: 6 * 60, endMin: 7 * 60 })
    expect(clampBlockToDay(22 * 60, 26 * 60, time)).toEqual({ startMin: 22 * 60, endMin: 24 * 60 })
  })

  it('adds days to ISO date', () => {
    expect(addDaysIso('2026-10-13', 2)).toBe('2026-10-15')
  })

  it('round-trips empty board JSON', () => {
    const board = emptyPlannerBoard('2026-10-13')
    const raw = serializePlannerBoard(board)
    const parsed = parsePlannerBoardJson(raw)
    expect(parsed).toEqual(board)
  })

  it('rejects wrong version', () => {
    expect(normalizePlannerBoard({ version: 2, range: {}, time: {}, blocks: [], notes: [] })).toBeNull()
  })

  it('migrates legacy body into sections', () => {
    const parsed = normalizePlannerBoard({
      version: 1,
      range: { startDate: '2026-10-13', dayCount: 1 },
      time: { startHour: 6, endHour: 24, snapMinutes: 15 },
      blocks: [
        {
          id: 'b1',
          dayOffset: 0,
          startMin: 600,
          endMin: 660,
          title: 'Test',
          body: 'stara notatka',
        },
      ],
      notes: [],
    })
    expect(parsed?.blocks[0]?.sections).toHaveLength(1)
    expect(parsed?.blocks[0]?.sections[0]?.text).toBe('stara notatka')
    expect(parsed?.blocks[0]?.sections[0]?.title).toBe('')
  })

  it('lays out concurrent blocks side by side', () => {
    const blocks: PlannerBlock[] = [
      { id: 'a', dayOffset: 0, startMin: 9 * 60, endMin: 11 * 60, title: 'A', sections: [] },
      { id: 'b', dayOffset: 0, startMin: 10 * 60, endMin: 12 * 60, title: 'B', sections: [] },
      { id: 'c', dayOffset: 0, startMin: 14 * 60, endMin: 15 * 60, title: 'C', sections: [] },
    ]
    const layout = layoutOverlappingBlocks(blocks)
    expect(layout.get('a')).toEqual({ col: 0, colCount: 2 })
    expect(layout.get('b')).toEqual({ col: 1, colCount: 2 })
    expect(layout.get('c')).toEqual({ col: 0, colCount: 1 })
  })
})
