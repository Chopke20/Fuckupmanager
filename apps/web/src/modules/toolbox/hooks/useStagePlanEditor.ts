import { useCallback, useMemo, useState } from 'react'
import {
  buildStagePlan,
  createStageDeck,
  emptyStagePlanInput,
  fillRectWithDecks,
  rotateStageDeck,
  roundM,
  snapToStep,
  STAGE_MAX_DECKS,
  type StageDeckKind,
  type StagePlan,
  type StagePlanInput,
} from '@lama-stage/shared-types'

const HISTORY_LIMIT = 60

export type StagePlanUpdater = (prev: StagePlanInput) => StagePlanInput

export function stagePlanToInput(plan: StagePlan): StagePlanInput {
  return {
    decks: plan.decks,
    stairs: plan.stairs,
    claddingMaterial: plan.claddingMaterial,
    cladding: plan.cladding,
    floorMaterial: plan.floorMaterial,
    railings: plan.railings,
    legHeightCm: plan.legHeightCm,
    snapToGrid: plan.snapToGrid,
    gridStepM: plan.gridStepM,
  }
}

interface HistoryState {
  past: StagePlanInput[]
  present: StagePlanInput
  future: StagePlanInput[]
}

export interface StagePlanEditor {
  plan: StagePlan
  input: StagePlanInput
  selectedDeckIds: string[]
  selectedStairId: string | null
  canUndo: boolean
  canRedo: boolean
  /** Zmiana zamykana w historii — zwykłe kliknięcie, przycisk, pole formularza. */
  commit: (updater: StagePlanUpdater) => void
  /** Zmiana na żywo w trakcie przeciągania, bez wpisu do historii. */
  preview: (updater: StagePlanUpdater) => void
  /** Zapamiętuje stan przed serią zmian na żywo. */
  beginChange: () => void
  undo: () => void
  redo: () => void
  selectDecks: (ids: string[]) => void
  selectStair: (id: string | null) => void
  patch: (partial: Partial<StagePlanInput>) => void
  addDeck: (kind: StageDeckKind) => void
  rotateSelected: () => void
  deleteSelected: () => void
  duplicateSelected: () => void
  nudgeSelected: (dxM: number, dyM: number) => void
  selectAll: () => void
  fillRect: (widthM: number, depthM: number, longAlongFront: boolean) => void
  clearAll: () => void
}

function defaultInput(): StagePlanInput {
  return { ...emptyStagePlanInput(), decks: fillRectWithDecks(6, 4, true) }
}

export function useStagePlanEditor(initialPlan?: StagePlan | null): StagePlanEditor {
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: initialPlan ? stagePlanToInput(initialPlan) : defaultInput(),
    future: [],
  }))
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([])
  const [selectedStairId, setSelectedStairId] = useState<string | null>(null)

  const input = history.present
  const plan = useMemo(() => buildStagePlan(input), [input])

  const commit = useCallback((updater: StagePlanUpdater) => {
    setHistory((state) => ({
      past: [...state.past, state.present].slice(-HISTORY_LIMIT),
      present: updater(state.present),
      future: [],
    }))
  }, [])

  const preview = useCallback((updater: StagePlanUpdater) => {
    setHistory((state) => ({ ...state, present: updater(state.present) }))
  }, [])

  const beginChange = useCallback(() => {
    setHistory((state) => ({
      past: [...state.past, state.present].slice(-HISTORY_LIMIT),
      present: state.present,
      future: [],
    }))
  }, [])

  const undo = useCallback(() => {
    setHistory((state) => {
      const previous = state.past[state.past.length - 1]
      if (!previous) return state
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((state) => {
      const next = state.future[0]
      if (!next) return state
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: state.future.slice(1),
      }
    })
  }, [])

  const patch = useCallback(
    (partial: Partial<StagePlanInput>) => {
      commit((prev) => ({ ...prev, ...partial }))
    },
    [commit]
  )

  /** Nowy blat ląduje obok ostatniego, żeby nie trafił pod już istniejący. */
  const addDeck = useCallback(
    (kind: StageDeckKind) => {
      commit((prev) => {
        if (prev.decks.length >= STAGE_MAX_DECKS) return prev
        const rightmost = prev.decks.reduce(
          (best, deck) => Math.max(best, deck.x + deck.w),
          0
        )
        const deck = createStageDeck(kind, rightmost + 0.5, 0)
        return { ...prev, decks: [...prev.decks, deck] }
      })
    },
    [commit]
  )

  const rotateSelected = useCallback(() => {
    if (selectedDeckIds.length === 0) return
    commit((prev) => ({
      ...prev,
      decks: prev.decks.map((deck) =>
        selectedDeckIds.includes(deck.id) ? rotateStageDeck(deck) : deck
      ),
    }))
  }, [commit, selectedDeckIds])

  const deleteSelected = useCallback(() => {
    if (selectedDeckIds.length === 0 && !selectedStairId) return
    commit((prev) => ({
      ...prev,
      decks: prev.decks.filter((deck) => !selectedDeckIds.includes(deck.id)),
      stairs: prev.stairs.filter((stair) => stair.id !== selectedStairId),
    }))
    setSelectedDeckIds([])
    setSelectedStairId(null)
  }, [commit, selectedDeckIds, selectedStairId])

  const duplicateSelected = useCallback(() => {
    if (selectedDeckIds.length === 0) return
    const copies: string[] = []
    commit((prev) => {
      const source = prev.decks.filter((deck) => selectedDeckIds.includes(deck.id))
      if (source.length === 0 || prev.decks.length + source.length > STAGE_MAX_DECKS) {
        return prev
      }
      const shift = Math.max(...source.map((deck) => deck.w))
      const clones = source.map((deck) => {
        const clone = createStageDeck(deck.kind, deck.x + shift, deck.y)
        copies.push(clone.id)
        return { ...clone, w: deck.w, h: deck.h }
      })
      return { ...prev, decks: [...prev.decks, ...clones] }
    })
    setSelectedDeckIds(copies)
  }, [commit, selectedDeckIds])

  const nudgeSelected = useCallback(
    (dxM: number, dyM: number) => {
      if (selectedDeckIds.length === 0) return
      commit((prev) => ({
        ...prev,
        decks: prev.decks.map((deck) =>
          selectedDeckIds.includes(deck.id)
            ? { ...deck, x: roundM(deck.x + dxM), y: roundM(deck.y + dyM) }
            : deck
        ),
      }))
    },
    [commit, selectedDeckIds]
  )

  const selectAll = useCallback(() => {
    setSelectedDeckIds(plan.decks.map((deck) => deck.id))
    setSelectedStairId(null)
  }, [plan.decks])

  const fillRect = useCallback(
    (widthM: number, depthM: number, longAlongFront: boolean) => {
      commit((prev) => ({
        ...prev,
        decks: fillRectWithDecks(widthM, depthM, longAlongFront),
        stairs: [],
      }))
      setSelectedDeckIds([])
      setSelectedStairId(null)
    },
    [commit]
  )

  const clearAll = useCallback(() => {
    commit((prev) => ({ ...prev, decks: [], stairs: [] }))
    setSelectedDeckIds([])
    setSelectedStairId(null)
  }, [commit])

  const selectDecks = useCallback((ids: string[]) => {
    setSelectedDeckIds(ids)
  }, [])

  const selectStair = useCallback((id: string | null) => {
    setSelectedStairId(id)
  }, [])

  return {
    plan,
    input,
    selectedDeckIds,
    selectedStairId,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    commit,
    preview,
    beginChange,
    undo,
    redo,
    selectDecks,
    selectStair,
    patch,
    addDeck,
    rotateSelected,
    deleteSelected,
    duplicateSelected,
    nudgeSelected,
    selectAll,
    fillRect,
    clearAll,
  }
}

/** Pozycja przyciągnięta do siatki albo dociągnięta magnetycznie do sąsiada. */
export function resolveDeckPosition(
  raw: number,
  size: number,
  neighbours: Array<{ start: number; size: number }>,
  snapToGrid: boolean,
  gridStepM: number,
  magnetM: number
): number {
  if (snapToGrid) return snapToStep(raw, gridStepM)
  let best = roundM(raw)
  let bestDistance = magnetM
  for (const neighbour of neighbours) {
    const candidates = [
      neighbour.start + neighbour.size,
      neighbour.start - size,
      neighbour.start,
      neighbour.start + neighbour.size - size,
    ]
    for (const candidate of candidates) {
      const distance = Math.abs(candidate - raw)
      if (distance < bestDistance) {
        bestDistance = distance
        best = roundM(candidate)
      }
    }
  }
  return best
}
