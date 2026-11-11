import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import axios from 'axios'
import type { UpsertStagePlanRoleMapDto } from '@lama-stage/shared-types'
import { useEquipment } from '../../equipment/hooks/useEquipment'
import {
  bulkUpsertStagePlanRoleMaps,
  listStagePlanRoleMaps,
} from '../api/stagePlanRoleMaps.api'
import {
  LED_SCREEN_CATALOG_KEY_LABELS,
  LED_SCREEN_ROLE_CONFIG_KEYS,
  ledScreenAreaM2,
  ledScreenBomLines,
  type LedScreenRoleConfigKey,
} from '../utils/ledScreenPlanSet'
import type { LedScreenProjectPayload } from '../calculators/ledScreen'

type UiAction = 'map' | 'skip'

type DraftRow = {
  roleKey: string
  action: UiAction | null
  equipmentId: string | null
}

function emptyDraft(roleKey: string): DraftRow {
  return { roleKey, action: null, equipmentId: null }
}

function apiErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as
      | { error?: string; message?: string; details?: { formErrors?: string[] } }
      | undefined
    const form = data?.details?.formErrors?.filter(Boolean).join(' ')
    return data?.error || data?.message || form || e.message || 'Zapis mapowania nieudany.'
  }
  return e instanceof Error ? e.message : 'Zapis mapowania nieudany.'
}

export default function LedScreenRoleMapModal({
  open,
  project,
  onClose,
  onSaved,
}: {
  open: boolean
  project: LedScreenProjectPayload
  onClose: () => void
  onSaved?: () => void
}) {
  const { data: catalogPage } = useEquipment({ limit: 500 })
  const catalog = useMemo(
    () => (catalogPage?.data ?? []).filter((eq) => eq.category !== 'ZASOBY'),
    [catalogPage?.data]
  )
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({})
  const [searchByRole, setSearchByRole] = useState<Record<string, string>>({})
  const [pickerRole, setPickerRole] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bom = useMemo(() => ledScreenBomLines(project), [project])
  const areaM2 = useMemo(() => ledScreenAreaM2(project), [project])

  const patchDraft = useCallback((roleKey: string, patch: Partial<DraftRow>) => {
    setDrafts((prev) => {
      const current = prev[roleKey] ?? emptyDraft(roleKey)
      return { ...prev, [roleKey]: { ...current, ...patch, roleKey } }
    })
  }, [])

  const load = useCallback(async () => {
    const maps = await listStagePlanRoleMaps()
    const out: Record<string, DraftRow> = {}
    for (const key of LED_SCREEN_ROLE_CONFIG_KEYS) out[key] = emptyDraft(key)
    for (const map of maps) {
      if (!(LED_SCREEN_ROLE_CONFIG_KEYS as readonly string[]).includes(map.roleKey)) continue
      out[map.roleKey] = {
        roleKey: map.roleKey,
        action: map.action === 'map' ? 'map' : 'skip',
        equipmentId: map.action === 'map' ? map.equipmentId ?? null : null,
      }
    }
    setDrafts(out)
    setSearchByRole({})
    setPickerRole(null)
  }, [])

  useEffect(() => {
    if (!open) return
    setError(null)
    void load().catch(() => setError('Nie udało się wczytać mapowań LED.'))
  }, [open, load])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const incomplete = LED_SCREEN_ROLE_CONFIG_KEYS.filter((key) => {
        const row = drafts[key] ?? emptyDraft(key)
        return row.action === 'map' && !row.equipmentId
      })
      if (incomplete.length > 0) {
        setError(
          `Wybierz sprzęt dla: ${incomplete
            .map((k) => LED_SCREEN_CATALOG_KEY_LABELS[k] ?? k)
            .join(', ')} (albo ustaw „Pomiń”).`
        )
        setPickerRole(incomplete[0] ?? null)
        return
      }
      const undecided = LED_SCREEN_ROLE_CONFIG_KEYS.filter((key) => {
        const row = drafts[key] ?? emptyDraft(key)
        return row.action == null
      })
      if (undecided.length > 0) {
        setError(
          `Ustaw Mapuj/Pomiń dla: ${undecided
            .map((k) => LED_SCREEN_CATALOG_KEY_LABELS[k] ?? k)
            .join(', ')}.`
        )
        return
      }

      const payload: UpsertStagePlanRoleMapDto[] = LED_SCREEN_ROLE_CONFIG_KEYS.map((key) => {
        const row = drafts[key] ?? emptyDraft(key)
        if (row.action === 'map' && row.equipmentId) {
          return { roleKey: key, action: 'map' as const, equipmentId: row.equipmentId }
        }
        return { roleKey: key, action: 'skip' as const }
      })
      await bulkUpsertStagePlanRoleMaps(payload)
      onSaved?.()
      onClose()
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-base font-semibold">Mapowanie LED → sprzęt</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-background">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-4">
          <p className="text-[11px] text-muted-foreground">
            Przypisz ekran, stabilizację i procesor do pozycji z katalogu. Zapis jest globalny dla
            firmy.
          </p>
          {error ? (
            <p className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-400">
              {error}
            </p>
          ) : null}
          {LED_SCREEN_ROLE_CONFIG_KEYS.map((key: LedScreenRoleConfigKey) => {
            const row = drafts[key] ?? emptyDraft(key)
            const qty = bom.find((line) => line.catalogKey === key)?.quantity ?? 0
            const qtyHint =
              (key === 'led-screen' || key === 'led-stabilization') && areaM2 > 0
                ? `${areaM2} m² → ${qty} szt.`
                : key === 'led-processor'
                  ? `${qty} szt. (ręcznie w wykazie)`
                  : `${qty} szt.`
            const selected = catalog.find((eq) => eq.id === row.equipmentId)
            const query = (searchByRole[key] ?? '').trim().toLowerCase()
            const options = catalog
              .filter((eq) => !query || eq.name.toLowerCase().includes(query) || (eq.category ?? '').toLowerCase().includes(query))
              .slice(0, 20)
            const showPicker = row.action === 'map' && (!selected || pickerRole === key)

            return (
              <div key={key} className="rounded border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {LED_SCREEN_CATALOG_KEY_LABELS[key] ?? key}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{qtyHint}</span>
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className={`rounded border px-2 py-1 text-xs ${
                      row.action === 'map'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
                    onClick={() => {
                      patchDraft(key, { action: 'map' })
                      if (!row.equipmentId) setPickerRole(key)
                    }}
                  >
                    Mapuj na sprzęt
                  </button>
                  <button
                    type="button"
                    className={`rounded border px-2 py-1 text-xs ${
                      row.action === 'skip'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
                    onClick={() => {
                      patchDraft(key, { action: 'skip', equipmentId: null })
                      if (pickerRole === key) setPickerRole(null)
                    }}
                  >
                    Pomiń
                  </button>
                </div>
                {row.action === 'map' ? (
                  <div className="space-y-1.5">
                    {selected && !showPicker ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-background px-2 py-1 text-xs">
                          {selected.name}
                          <span className="text-muted-foreground"> · {selected.category}</span>
                        </span>
                        <button
                          type="button"
                          className="text-[11px] text-primary hover:underline"
                          onClick={() => setPickerRole(key)}
                        >
                          Zmień
                        </button>
                      </div>
                    ) : (
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Search className="h-3 w-3" />
                          Szukaj sprzętu
                        </label>
                        <input
                          className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                          value={searchByRole[key] ?? ''}
                          onChange={(e) =>
                            setSearchByRole((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          placeholder="Nazwa / kategoria"
                          autoFocus={pickerRole === key}
                        />
                        <ul className="max-h-40 space-y-1 overflow-y-auto">
                          {options.length === 0 ? (
                            <li className="px-1 text-[11px] text-muted-foreground">Brak wyników</li>
                          ) : (
                            options.map((eq) => (
                              <li key={`${key}-${eq.id}`}>
                                <button
                                  type="button"
                                  className={`w-full rounded border px-2 py-1 text-left text-xs ${
                                    row.equipmentId === eq.id
                                      ? 'border-primary bg-primary/10'
                                      : 'border-border hover:bg-background'
                                  }`}
                                  onClick={() => {
                                    patchDraft(key, { action: 'map', equipmentId: eq.id })
                                    setPickerRole(null)
                                    setError(null)
                                  }}
                                >
                                  {eq.name}
                                  <span className="ml-1 text-muted-foreground">· {eq.category}</span>
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border px-3 py-1.5 text-xs"
          >
            Anuluj
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            {saving ? 'Zapis…' : 'Zapisz mapowanie'}
          </button>
        </div>
      </div>
    </div>
  )
}
