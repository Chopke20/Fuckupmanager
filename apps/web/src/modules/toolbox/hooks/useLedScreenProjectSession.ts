import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import {
  emptyLedScreenProject,
  parseLedScreenProjectJson,
  serializeLedScreenProject,
  type LedScreenProjectPayload,
} from '../calculators/ledScreen'
import {
  createLedScreenProject,
  getLedScreenProject,
  lastLedScreenProjectStorageKey,
  listLedScreenProjects,
  updateLedScreenProject,
  type LedScreenProject,
} from '../api/ledScreenProjects.api'

const AUTOSAVE_MS = 1500

function readLastProjectId(companyCode: string): string | null {
  try {
    return window.localStorage.getItem(lastLedScreenProjectStorageKey(companyCode))
  } catch {
    return null
  }
}

function writeLastProjectId(companyCode: string, projectId: string) {
  try {
    window.localStorage.setItem(lastLedScreenProjectStorageKey(companyCode), projectId)
  } catch {
    //
  }
}

export interface LedScreenProjectSession {
  loading: boolean
  saving: boolean
  error: string | null
  project: LedScreenProject | null
  payload: LedScreenProjectPayload
  projects: LedScreenProject[]
  pickerOpen: boolean
  setPickerOpen: (open: boolean) => void
  saveAsOpen: boolean
  setSaveAsOpen: (open: boolean) => void
  setPayload: (next: LedScreenProjectPayload) => void
  saveNow: () => Promise<void>
  saveAs: (name: string) => Promise<void>
  openProject: (id: string) => Promise<void>
  createNewProject: () => Promise<void>
  renameProject: (name: string) => Promise<void>
  refreshProjects: () => Promise<LedScreenProject[]>
}

export function useLedScreenProjectSession(opts?: {
  /** Gdy true — bez API (publiczny link). */
  localOnly?: boolean
}): LedScreenProjectSession {
  const localOnly = opts?.localOnly === true
  const { user } = useAuth()
  const companyCode = user?.companyCode ?? 'main'

  const [loading, setLoading] = useState(!localOnly)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [project, setProject] = useState<LedScreenProject | null>(null)
  const [payload, setPayloadState] = useState<LedScreenProjectPayload>(() => emptyLedScreenProject())
  const [projects, setProjects] = useState<LedScreenProject[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saveAsOpen, setSaveAsOpen] = useState(false)

  const projectRef = useRef<LedScreenProject | null>(null)
  const payloadRef = useRef(payload)
  const autosaveTimerRef = useRef<number | null>(null)
  const skipAutosaveRef = useRef(true)

  projectRef.current = project
  payloadRef.current = payload

  const refreshProjects = useCallback(async () => {
    if (localOnly) return []
    const list = await listLedScreenProjects()
    setProjects(list)
    return list
  }, [localOnly])

  const activateProject = useCallback(
    (next: LedScreenProject) => {
      skipAutosaveRef.current = true
      setProject(next)
      const parsed = parseLedScreenProjectJson(next.projectJson) ?? emptyLedScreenProject()
      setPayloadState(parsed)
      writeLastProjectId(companyCode, next.id)
      window.setTimeout(() => {
        skipAutosaveRef.current = false
      }, 0)
    },
    [companyCode]
  )

  useEffect(() => {
    if (localOnly) {
      setLoading(false)
      skipAutosaveRef.current = false
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const list = await listLedScreenProjects()
        if (cancelled) return
        setProjects(list)
        const lastId = readLastProjectId(companyCode)
        let chosen: LedScreenProject | null = null
        if (lastId) {
          try {
            chosen = await getLedScreenProject(lastId)
          } catch {
            chosen = list.find((item) => item.id === lastId) ?? null
          }
        }
        if (!chosen) chosen = list[0] ?? null
        if (!chosen) {
          const created = await createLedScreenProject({
            name: 'Projekt LED',
            projectJson: serializeLedScreenProject(emptyLedScreenProject()),
          })
          if (cancelled) return
          activateProject(created)
          setProjects((prev) => [created, ...prev.filter((p) => p.id !== created.id)])
        } else {
          activateProject(chosen)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Nie udało się załadować projektów LED.')
          skipAutosaveRef.current = false
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activateProject, companyCode, localOnly])

  const persist = useCallback(
    async (target: LedScreenProject, nextPayload: LedScreenProjectPayload) => {
      setSaving(true)
      setError(null)
      try {
        const updated = await updateLedScreenProject(target.id, {
          projectJson: serializeLedScreenProject(nextPayload),
        })
        setProject(updated)
        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Zapis nieudany.')
        throw e
      } finally {
        setSaving(false)
      }
    },
    []
  )

  const setPayload = useCallback(
    (next: LedScreenProjectPayload) => {
      setPayloadState(next)
      if (localOnly || skipAutosaveRef.current || !projectRef.current) return
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = window.setTimeout(() => {
        const current = projectRef.current
        if (!current) return
        void persist(current, next)
      }, AUTOSAVE_MS)
    },
    [localOnly, persist]
  )

  const saveNow = useCallback(async () => {
    if (localOnly) return
    const current = projectRef.current
    if (!current) return
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
    await persist(current, payloadRef.current)
  }, [localOnly, persist])

  const saveAs = useCallback(
    async (name: string) => {
      if (localOnly) return
      const trimmed = name.trim()
      if (!trimmed) return
      setSaving(true)
      setError(null)
      try {
        const created = await createLedScreenProject({
          name: trimmed,
          projectJson: serializeLedScreenProject(payloadRef.current),
        })
        activateProject(created)
        setProjects((prev) => [created, ...prev])
        setSaveAsOpen(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Zapisz jako — błąd.')
      } finally {
        setSaving(false)
      }
    },
    [activateProject, localOnly]
  )

  const openProject = useCallback(
    async (id: string) => {
      if (localOnly) return
      setError(null)
      const next = await getLedScreenProject(id)
      activateProject(next)
      setPickerOpen(false)
    },
    [activateProject, localOnly]
  )

  const createNewProject = useCallback(async () => {
    if (localOnly) {
      setPayloadState(emptyLedScreenProject())
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await createLedScreenProject({
        name: 'Nowy projekt LED',
        projectJson: serializeLedScreenProject(emptyLedScreenProject()),
      })
      activateProject(created)
      setProjects((prev) => [created, ...prev])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie utworzono projektu.')
    } finally {
      setSaving(false)
    }
  }, [activateProject, localOnly])

  const renameProject = useCallback(
    async (name: string) => {
      if (localOnly || !projectRef.current) return
      const trimmed = name.trim()
      if (!trimmed) return
      const updated = await updateLedScreenProject(projectRef.current.id, { name: trimmed })
      setProject(updated)
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    },
    [localOnly]
  )

  return useMemo(
    () => ({
      loading,
      saving,
      error,
      project,
      payload,
      projects,
      pickerOpen,
      setPickerOpen,
      saveAsOpen,
      setSaveAsOpen,
      setPayload,
      saveNow,
      saveAs,
      openProject,
      createNewProject,
      renameProject,
      refreshProjects,
    }),
    [
      loading,
      saving,
      error,
      project,
      payload,
      projects,
      pickerOpen,
      saveAsOpen,
      setPayload,
      saveNow,
      saveAs,
      openProject,
      createNewProject,
      renameProject,
      refreshProjects,
    ]
  )
}
