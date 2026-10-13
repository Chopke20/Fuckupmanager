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

  it('lays out concurrent blocks side by side', () => {
    const blocks: PlannerBlock[] = [
      { id: 'a', dayOffset: 0, startMin: 9 * 60, endMin: 11 * 60, title: 'A' },
      { id: 'b', dayOffset: 0, startMin: 10 * 60, endMin: 12 * 60, title: 'B' },
      { id: 'c', dayOffset: 0, startMin: 14 * 60, endMin: 15 * 60, title: 'C' },
    ]
    const layout = layoutOverlappingBlocks(blocks)
    expect(layout.get('a')).toEqual({ col: 0, colCount: 2 })
    expect(layout.get('b')).toEqual({ col: 1, colCount: 2 })
    expect(layout.get('c')).toEqual({ col: 0, colCount: 1 })
  })
})
