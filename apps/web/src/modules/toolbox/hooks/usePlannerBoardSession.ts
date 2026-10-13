import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import {
  emptyPlannerBoard,
  parsePlannerBoardJson,
  serializePlannerBoard,
  type PlannerBoardPayload,
} from '../planner/plannerTypes'
import {
  createPlannerBoard,
  getPlannerBoard,
  lastPlannerBoardStorageKey,
  listPlannerBoards,
  updatePlannerBoard,
  type PlannerBoard,
} from '../api/plannerBoards.api'

const AUTOSAVE_MS = 1500

function readLastBoardId(companyCode: string): string | null {
  try {
    return window.localStorage.getItem(lastPlannerBoardStorageKey(companyCode))
  } catch {
    return null
  }
}

function writeLastBoardId(companyCode: string, boardId: string) {
  try {
    window.localStorage.setItem(lastPlannerBoardStorageKey(companyCode), boardId)
  } catch {
    //
  }
}

export interface PlannerBoardSession {
  loading: boolean
  saving: boolean
  error: string | null
  board: PlannerBoard | null
  payload: PlannerBoardPayload
  boards: PlannerBoard[]
  pickerOpen: boolean
  setPickerOpen: (open: boolean) => void
  saveAsOpen: boolean
  setSaveAsOpen: (open: boolean) => void
  setPayload: (next: PlannerBoardPayload) => void
  saveNow: () => Promise<void>
  saveAs: (name: string) => Promise<void>
  openBoard: (id: string) => Promise<void>
  createNewBoard: () => Promise<void>
  renameBoard: (name: string) => Promise<void>
  refreshBoards: () => Promise<PlannerBoard[]>
}

export function usePlannerBoardSession(): PlannerBoardSession {
  const { user } = useAuth()
  const companyCode = user?.companyCode ?? 'main'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [board, setBoard] = useState<PlannerBoard | null>(null)
  const [payload, setPayloadState] = useState<PlannerBoardPayload>(() => emptyPlannerBoard())
  const [boards, setBoards] = useState<PlannerBoard[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saveAsOpen, setSaveAsOpen] = useState(false)

  const boardRef = useRef<PlannerBoard | null>(null)
  const payloadRef = useRef(payload)
  const autosaveTimerRef = useRef<number | null>(null)
  const skipAutosaveRef = useRef(true)

  boardRef.current = board
  payloadRef.current = payload

  const refreshBoards = useCallback(async () => {
    const list = await listPlannerBoards()
    setBoards(list)
    return list
  }, [])

  const activateBoard = useCallback(
    (next: PlannerBoard) => {
      skipAutosaveRef.current = true
      setBoard(next)
      const parsed = parsePlannerBoardJson(next.boardJson) ?? emptyPlannerBoard()
      setPayloadState(parsed)
      writeLastBoardId(companyCode, next.id)
      window.setTimeout(() => {
        skipAutosaveRef.current = false
      }, 0)
    },
    [companyCode]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const list = await listPlannerBoards()
        if (cancelled) return
        setBoards(list)
        const lastId = readLastBoardId(companyCode)
        let chosen: PlannerBoard | null = null
        if (lastId) {
          try {
            chosen = await getPlannerBoard(lastId)
          } catch {
            chosen = list.find((item) => item.id === lastId) ?? null
          }
        }
        if (!chosen) chosen = list[0] ?? null
        if (!chosen) {
          const created = await createPlannerBoard({
            name: 'Planer',
            boardJson: serializePlannerBoard(emptyPlannerBoard()),
          })
          if (cancelled) return
          activateBoard(created)
          setBoards((prev) => [created, ...prev.filter((p) => p.id !== created.id)])
        } else {
          activateBoard(chosen)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Nie udało się załadować tablic.')
          skipAutosaveRef.current = false
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activateBoard, companyCode])

  const persist = useCallback(async (target: PlannerBoard, nextPayload: PlannerBoardPayload) => {
    setSaving(true)
    setError(null)
    try {
      const updated = await updatePlannerBoard(target.id, {
        boardJson: serializePlannerBoard(nextPayload),
      })
      setBoard(updated)
      setBoards((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zapis nieudany.')
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  const setPayload = useCallback(
    (next: PlannerBoardPayload) => {
      setPayloadState(next)
      if (skipAutosaveRef.current || !boardRef.current) return
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = window.setTimeout(() => {
        const current = boardRef.current
        if (!current) return
        void persist(current, next)
      }, AUTOSAVE_MS)
    },
    [persist]
  )

  const saveNow = useCallback(async () => {
    const current = boardRef.current
    if (!current) return
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
    await persist(current, payloadRef.current)
  }, [persist])

  const saveAs = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      setSaving(true)
      setError(null)
      try {
        const created = await createPlannerBoard({
          name: trimmed,
          boardJson: serializePlannerBoard(payloadRef.current),
        })
        activateBoard(created)
        setBoards((prev) => [created, ...prev])
        setSaveAsOpen(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Zapisz jako — błąd.')
      } finally {
        setSaving(false)
      }
    },
    [activateBoard]
  )

  const openBoard = useCallback(
    async (id: string) => {
      setError(null)
      const next = await getPlannerBoard(id)
      activateBoard(next)
      setPickerOpen(false)
    },
    [activateBoard]
  )

  const createNewBoard = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const created = await createPlannerBoard({
        name: 'Nowa tablica',
        boardJson: serializePlannerBoard(emptyPlannerBoard()),
      })
      activateBoard(created)
      setBoards((prev) => [created, ...prev])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie utworzono tablicy.')
    } finally {
      setSaving(false)
    }
  }, [activateBoard])

  const renameBoard = useCallback(async (name: string) => {
    if (!boardRef.current) return
    const trimmed = name.trim()
    if (!trimmed) return
    const updated = await updatePlannerBoard(boardRef.current.id, { name: trimmed })
    setBoard(updated)
    setBoards((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }, [])

  return useMemo(
    () => ({
      loading,
      saving,
      error,
      board,
      payload,
      boards,
      pickerOpen,
      setPickerOpen,
      saveAsOpen,
      setSaveAsOpen,
      setPayload,
      saveNow,
      saveAs,
      openBoard,
      createNewBoard,
      renameBoard,
      refreshBoards,
    }),
    [
      loading,
      saving,
      error,
      board,
      payload,
      boards,
      pickerOpen,
      saveAsOpen,
      setPayload,
      saveNow,
      saveAs,
      openBoard,
      createNewBoard,
      renameBoard,
      refreshBoards,
    ]
  )
}
