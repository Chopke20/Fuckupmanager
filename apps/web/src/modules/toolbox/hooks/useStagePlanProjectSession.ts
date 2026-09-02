import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildStagePlan,
  emptyStagePlanInput,
  fillRectWithDecks,
  parseStagePlanJson,
  serializeStagePlan,
  type StagePlan,
} from '@lama-stage/shared-types'
import { useAuth } from '../../auth/AuthProvider'
import {
  createStagePlanProject,
  getStagePlanProject,
  lastStagePlanProjectStorageKey,
  listStagePlanProjects,
  updateStagePlanProject,
  type StagePlanProject,
} from '../api/stagePlanProjects.api'

const AUTOSAVE_MS = 1500
const STALE_PENDING_MS = 15_000

function defaultPlanJson(): string {
  return serializeStagePlan(
    buildStagePlan({
      ...emptyStagePlanInput(),
      decks: fillRectWithDecks(6, 4, true),
    })
  )
}

function readLastProjectId(companyCode: string): string | null {
  try {
    return window.localStorage.getItem(lastStagePlanProjectStorageKey(companyCode))
  } catch {
    return null
  }
}

function writeLastProjectId(companyCode: string, projectId: string) {
  try {
    window.localStorage.setItem(lastStagePlanProjectStorageKey(companyCode), projectId)
  } catch {
    //
  }
}

export interface StagePlanProjectSession {
  loading: boolean
  saving: boolean
  busy: boolean
  saveStatus: 'ok' | 'error'
  lastSavedAt: number | null
  error: string | null
  project: StagePlanProject | null
  initialPlan: StagePlan | null
  projects: StagePlanProject[]
  pickerOpen: boolean
  setPickerOpen: (open: boolean) => void
  saveAsOpen: boolean
  setSaveAsOpen: (open: boolean) => void
  refreshProjects: () => Promise<StagePlanProject[]>
  handlePlanChange: (plan: StagePlan) => void
  saveNow: (plan: StagePlan) => Promise<void>
  saveAs: (name: string, plan: StagePlan) => Promise<void>
  openProject: (id: string) => Promise<void>
  createNewProject: () => Promise<void>
  renameProject: (name: string) => Promise<void>
}

export function useStagePlanProjectSession(): StagePlanProjectSession {
  const { user } = useAuth()
  const companyCode = user?.companyCode ?? 'main'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [pendingSince, setPendingSince] = useState<number | null>(null)
  const [project, setProject] = useState<StagePlanProject | null>(null)
  const [initialPlan, setInitialPlan] = useState<StagePlan | null>(null)
  const [projects, setProjects] = useState<StagePlanProject[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())

  const projectRef = useRef<StagePlanProject | null>(null)
  const pendingPlanRef = useRef<StagePlan | null>(null)
  const autosaveTimerRef = useRef<number | null>(null)
  const skipAutosaveRef = useRef(true)

  projectRef.current = project

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 5000)
    return () => window.clearInterval(timer)
  }, [])

  const saveStatus: 'ok' | 'error' = useMemo(() => {
    if (consecutiveFailures >= 2) return 'error'
    if (pendingSince != null && nowTick - pendingSince >= STALE_PENDING_MS) return 'error'
    return 'ok'
  }, [consecutiveFailures, pendingSince, nowTick])

  const refreshProjects = useCallback(async () => {
    const list = await listStagePlanProjects()
    setProjects(list)
    return list
  }, [])

  const activateProject = useCallback(
    (next: StagePlanProject) => {
      skipAutosaveRef.current = true
      pendingPlanRef.current = null
      setPendingSince(null)
      setProject(next)
      setInitialPlan(parseStagePlanJson(next.planJson))
      writeLastProjectId(companyCode, next.id)
      window.setTimeout(() => {
        skipAutosaveRef.current = false
      }, 0)
    },
    [companyCode]
  )

  const bootstrap = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listStagePlanProjects()
      setProjects(list)

      const lastId = readLastProjectId(companyCode)
      let chosen: StagePlanProject | null = null

      if (lastId) {
        try {
          chosen = await getStagePlanProject(lastId)
        } catch {
          chosen = list.find((item) => item.id === lastId) ?? null
        }
      }

      if (!chosen) {
        chosen = list[0] ?? null
      }

      if (!chosen) {
        const created = await createStagePlanProject({
          name: 'Projekt 1',
          planJson: defaultPlanJson(),
        })
        chosen = created
        setProjects([created])
      }

      activateProject(chosen)
      setLastSavedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się wczytać projektów.')
      setConsecutiveFailures((value) => value + 1)
    } finally {
      setLoading(false)
    }
  }, [activateProject, companyCode])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const persistPlan = useCallback(async (plan: StagePlan, target = projectRef.current) => {
    if (!target) return
    setSaving(true)
    try {
      const updated = await updateStagePlanProject(target.id, {
        planJson: serializeStagePlan(plan),
      })
      setProject(updated)
      setProjects((prev) => {
        const rest = prev.filter((item) => item.id !== updated.id)
        return [updated, ...rest]
      })
      setError(null)
      setConsecutiveFailures(0)
      setLastSavedAt(Date.now())
      setPendingSince(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Nie udało się zapisać projektu.'
      setError(message)
      setConsecutiveFailures((value) => value + 1)
    } finally {
      setSaving(false)
    }
  }, [])

  const scheduleAutosave = useCallback(
    (plan: StagePlan) => {
      pendingPlanRef.current = plan
      setPendingSince((value) => value ?? Date.now())
      if (autosaveTimerRef.current != null) {
        window.clearTimeout(autosaveTimerRef.current)
      }
      autosaveTimerRef.current = window.setTimeout(() => {
        autosaveTimerRef.current = null
        const pending = pendingPlanRef.current
        if (pending && !skipAutosaveRef.current) {
          void persistPlan(pending)
        }
      }, AUTOSAVE_MS)
    },
    [persistPlan]
  )

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current != null) {
        window.clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [])

  const handlePlanChange = useCallback(
    (plan: StagePlan) => {
      if (skipAutosaveRef.current) return
      scheduleAutosave(plan)
    },
    [scheduleAutosave]
  )

  const saveNow = useCallback(
    async (plan: StagePlan) => {
      if (autosaveTimerRef.current != null) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      pendingPlanRef.current = plan
      await persistPlan(plan)
    },
    [persistPlan]
  )

  const saveAs = useCallback(
    async (name: string, plan: StagePlan) => {
      setBusy(true)
      setError(null)
      try {
        const created = await createStagePlanProject({
          name: name.trim(),
          planJson: serializeStagePlan(plan),
        })
        setProjects((prev) => [created, ...prev])
        activateProject(created)
        setLastSavedAt(Date.now())
        setSaveAsOpen(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Nie udało się zapisać projektu.')
        setConsecutiveFailures((value) => value + 1)
      } finally {
        setBusy(false)
      }
    },
    [activateProject]
  )

  const openProject = useCallback(
    async (id: string) => {
      setBusy(true)
      try {
        if (pendingPlanRef.current && projectRef.current && !skipAutosaveRef.current) {
          await persistPlan(pendingPlanRef.current)
        }
        const loaded = await getStagePlanProject(id)
        activateProject(loaded)
        setLastSavedAt(Date.now())
        setPickerOpen(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Nie udało się otworzyć projektu.')
        setConsecutiveFailures((value) => value + 1)
      } finally {
        setBusy(false)
      }
    },
    [activateProject, persistPlan]
  )

  const createNewProject = useCallback(async () => {
    setBusy(true)
    try {
      if (pendingPlanRef.current && projectRef.current && !skipAutosaveRef.current) {
        await persistPlan(pendingPlanRef.current)
      }
      const count = projects.length + 1
      const created = await createStagePlanProject({
        name: `Projekt ${count}`,
        planJson: defaultPlanJson(),
      })
      setProjects((prev) => [created, ...prev])
      activateProject(created)
      setLastSavedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się utworzyć projektu.')
      setConsecutiveFailures((value) => value + 1)
    } finally {
      setBusy(false)
    }
  }, [activateProject, persistPlan, projects.length])

  const renameProject = useCallback(async (name: string) => {
    if (!projectRef.current) return
    setBusy(true)
    try {
      const updated = await updateStagePlanProject(projectRef.current.id, { name: name.trim() })
      setProject(updated)
      setProjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zmienić nazwy.')
      setConsecutiveFailures((value) => value + 1)
    } finally {
      setBusy(false)
    }
  }, [])

  return {
    loading,
    saving,
    busy,
    saveStatus,
    lastSavedAt,
    error,
    project,
    initialPlan,
    projects,
    pickerOpen,
    setPickerOpen,
    saveAsOpen,
    setSaveAsOpen,
    refreshProjects,
    handlePlanChange,
    saveNow,
    saveAs,
    openProject,
    createNewProject,
    renameProject,
  }
}
