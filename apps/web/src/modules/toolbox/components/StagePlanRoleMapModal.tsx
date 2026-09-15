import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Settings2, X } from 'lucide-react'
import type {
  Equipment,
  StageBomLine,
  StagePlan,
  StagePlanRoleMap,
  UpsertStagePlanRoleMapDto,
} from '@lama-stage/shared-types'
import {
  STAGE_PLAN_CATALOG_KEY_LABELS,
  STAGE_PLAN_ROLE_CONFIG_KEYS,
  formatMeters,
  resolveStagePlanOrderLines,
  stagePlanApplyBlockingIssues,
} from '@lama-stage/shared-types'
import { useEquipment } from '../../equipment/hooks/useEquipment'
import { equipmentApi } from '../../equipment/api/equipment.api'
import {
  bulkUpsertStagePlanRoleMaps,
  deleteStagePlanRoleMap,
  listStagePlanRoleMaps,
} from '../api/stagePlanRoleMaps.api'

type UiAction = 'map' | 'skip'

type DraftRow = {
  roleKey: string
  /** null = jeszcze nie ustawione */
  action: UiAction | null
  equipmentId: string | null
}

function emptyDraft(roleKey: string): DraftRow {
  return { roleKey, action: null, equipmentId: null }
}

function draftsFromMaps(maps: StagePlanRoleMap[]): Record<string, DraftRow> {
  const out: Record<string, DraftRow> = {}
  for (const key of STAGE_PLAN_ROLE_CONFIG_KEYS) {
    out[key] = emptyDraft(key)
  }
  for (const map of maps) {
    // Stare „attach” traktujemy jak „pomiń w zleceniu” — bez osobnej linii.
    const action: UiAction =
      map.action === 'map' ? 'map' : 'skip'
    out[map.roleKey] = {
      roleKey: map.roleKey,
      action,
      equipmentId: action === 'map' ? map.equipmentId ?? null : null,
    }
  }
  return out
}

function quantityForRole(plan: StagePlan, roleKey: string): { quantity: number; unit: string } | null {
  if (roleKey === 'legs') {
    const lines = plan.bom.filter((line) => line.catalogKey.startsWith('legs-'))
    if (lines.length === 0) return null
    return { quantity: lines.reduce((acc, line) => acc + line.quantity, 0), unit: 'szt.' }
  }
  if (roleKey === 'stairs') {
    const lines = plan.bom.filter((line) => line.catalogKey.startsWith('stairs-'))
    if (lines.length === 0) return null
    return { quantity: lines.reduce((acc, line) => acc + line.quantity, 0), unit: 'szt.' }
  }
  const line = plan.bom.find((item) => item.catalogKey === roleKey)
  if (!line) return null
  return { quantity: line.quantity, unit: line.unit }
}

function bomDisplayName(line: StageBomLine): string {
  return line.name.replace(/\s*\([^)]*\)\s*$/, '').trim() || line.name
}

export default function StagePlanRoleMapModal({
  open,
  plan,
  onClose,
  onSaved,
}: {
  open: boolean
  plan: StagePlan
  onClose: () => void
  onSaved?: (maps: StagePlanRoleMap[]) => void
}) {
  const { data: catalogPage, refetch: refetchCatalog } = useEquipment({ limit: 500 })
  const catalog = catalogPage?.data ?? []
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchByRole, setSearchByRole] = useState<Record<string, string>>({})
  const [pickerRole, setPickerRole] = useState<string | null>(null)
  const [creatingRole, setCreatingRole] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const maps = await listStagePlanRoleMaps()
      setDrafts(draftsFromMaps(maps))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się wczytać mapowań.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setPickerRole(null)
      void load()
    }
  }, [open, load])

  const roleMapsEntries = useMemo(
    () =>
      Object.values(drafts)
        .filter((row) => row.action === 'map' || row.action === 'skip')
        .map((row) => ({
          roleKey: row.roleKey,
          action: row.action as UiAction,
          equipmentId: row.equipmentId,
          attachToRoleKey: null,
        })),
    [drafts]
  )

  const preview = useMemo(
    () =>
      resolveStagePlanOrderLines({
        plan,
        maps: roleMapsEntries,
        catalog,
      }),
    [plan, roleMapsEntries, catalog]
  )

  const patchDraft = (roleKey: string, patch: Partial<DraftRow>) => {
    setDrafts((prev) => ({
      ...prev,
      [roleKey]: { ...(prev[roleKey] ?? emptyDraft(roleKey)), ...patch, roleKey },
    }))
  }

  const createEquipmentForRole = async (roleKey: string) => {
    setCreatingRole(roleKey)
    setError(null)
    try {
      const sample =
        plan.bom.find((line) => line.catalogKey === roleKey) ||
        (roleKey === 'legs'
          ? plan.bom.find((line) => line.catalogKey.startsWith('legs-'))
          : roleKey === 'stairs'
            ? plan.bom.find((line) => line.catalogKey.startsWith('stairs-'))
            : undefined)
      const { proposedCode } = await equipmentApi.getNextCode('Scena')
      const created = await equipmentApi.create({
        name:
          STAGE_PLAN_CATALOG_KEY_LABELS[roleKey] ??
          bomDisplayName(sample ?? ({ name: roleKey } as StageBomLine)),
        category: 'Scena',
        unit: sample?.unit ?? 'szt.',
        dailyPrice: 0,
        stockQuantity: 1,
        visibleInOffer: sample?.offer ?? true,
        internalCode: proposedCode,
        pricingRule: { day1: 1.0, nextDays: 0.5 },
      })
      await refetchCatalog()
      patchDraft(roleKey, { action: 'map', equipmentId: created.id })
      setPickerRole(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się utworzyć pozycji.')
    } finally {
      setCreatingRole(null)
    }
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const toUpsert: UpsertStagePlanRoleMapDto[] = []
      const toDelete: string[] = []
      for (const row of Object.values(drafts)) {
        if (row.action === null) {
          toDelete.push(row.roleKey)
          continue
        }
        if (row.action === 'map' && !row.equipmentId) {
          setError(`Rola „${STAGE_PLAN_CATALOG_KEY_LABELS[row.roleKey] ?? row.roleKey}” ma Mapuj bez wybranej pozycji.`)
          setSaving(false)
          return
        }
        toUpsert.push({
          roleKey: row.roleKey,
          action: row.action,
          equipmentId: row.action === 'map' ? row.equipmentId : null,
          attachToRoleKey: null,
        })
      }
      await Promise.all(toDelete.map((roleKey) => deleteStagePlanRoleMap(roleKey).catch(() => undefined)))
      const saved = toUpsert.length > 0 ? await bulkUpsertStagePlanRoleMaps(toUpsert) : await listStagePlanRoleMaps()
      onSaved?.(saved)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać mapowań.')
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
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Settings2 size={16} />
            <h2 className="text-base font-bold">Mapowanie ról → sprzęt</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border p-1 text-muted-foreground hover:text-foreground"
            aria-label="Zamknij"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto px-3 py-2">
          <p className="text-[11px] leading-snug text-muted-foreground">
            Przypisz pozycję z kreatora do pozycji z bazy sprzętu lub stwórz nową pozycję. „Pomiń”
            zostawia pozycję w planie sceny, ale nie dodaje jej do zlecenia. Zapis jest globalny dla
            firmy.
          </p>

          {error ? (
            <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-500">
              {error}
            </div>
          ) : null}

          {loading ? (
            <p className="text-xs text-muted-foreground">Wczytywanie…</p>
          ) : (
            <div className="overflow-hidden rounded border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">Rola</th>
                    <th className="px-2 py-1.5 text-right font-medium">Ilość</th>
                    <th className="px-2 py-1.5 font-medium">Akcja</th>
                    <th className="px-2 py-1.5 font-medium">Sprzęt</th>
                  </tr>
                </thead>
                <tbody>
                  {STAGE_PLAN_ROLE_CONFIG_KEYS.map((roleKey) => {
                    const draft = drafts[roleKey] ?? emptyDraft(roleKey)
                    const qty = quantityForRole(plan, roleKey)
                    const inPlan = qty != null
                    const needsDecision = inPlan && draft.action === null
                    const query = (searchByRole[roleKey] ?? '').trim().toLowerCase()
                    const options = catalog
                      .filter((item) => item.category !== 'ZASOBY')
                      .filter((item) => !query || item.name.toLowerCase().includes(query))
                      .slice(0, 12)
                    const selected = catalog.find((item) => item.id === draft.equipmentId)
                    const showPicker = draft.action === 'map' && (!selected || pickerRole === roleKey)

                    return (
                      <tr
                        key={roleKey}
                        className={`border-t border-border/60 align-top ${
                          needsDecision ? 'bg-warning/5' : ''
                        }`}
                      >
                        <td className="px-2 py-1.5">
                          <div className="font-medium leading-tight">
                            {STAGE_PLAN_CATALOG_KEY_LABELS[roleKey] ?? roleKey}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{roleKey}</div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                          {qty ? `${formatMeters(qty.quantity)} ${qty.unit}` : '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          <div
                            className={`inline-flex rounded border ${
                              needsDecision ? 'border-warning' : 'border-border'
                            }`}
                          >
                            {(
                              [
                                ['map', 'Mapuj'],
                                ['skip', 'Pomiń'],
                              ] as const
                            ).map(([action, label], index) => (
                              <button
                                key={action}
                                type="button"
                                onClick={() => {
                                  patchDraft(roleKey, {
                                    action,
                                    equipmentId: action === 'map' ? draft.equipmentId : null,
                                  })
                                  if (action === 'map' && !draft.equipmentId) setPickerRole(roleKey)
                                  if (action === 'skip') setPickerRole(null)
                                }}
                                className={`px-1.5 py-0.5 text-[10px] ${
                                  index > 0 ? 'border-l border-border' : ''
                                } ${
                                  draft.action === action
                                    ? 'bg-primary/15 text-primary'
                                    : needsDecision && action === 'map'
                                      ? 'text-warning hover:text-foreground'
                                      : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="min-w-[14rem] px-2 py-1.5">
                          {draft.action === 'map' ? (
                            <div className="space-y-1">
                              {selected && pickerRole !== roleKey ? (
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="truncate rounded bg-surface-2 px-1.5 py-0.5">
                                    {selected.name}
                                    <span className="text-muted-foreground">
                                      {' '}
                                      · {selected.dailyPrice} zł
                                      {selected.visibleInOffer === false ? ' · mag.' : ''}
                                    </span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setPickerRole(roleKey)}
                                    className="text-[10px] text-muted-foreground hover:text-foreground"
                                  >
                                    Zmień
                                  </button>
                                </div>
                              ) : null}

                              {showPicker ? (
                                <div className="space-y-1">
                                  <div className="relative">
                                    <Search
                                      size={11}
                                      className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <input
                                      type="text"
                                      value={searchByRole[roleKey] ?? ''}
                                      onChange={(e) =>
                                        setSearchByRole((prev) => ({
                                          ...prev,
                                          [roleKey]: e.target.value,
                                        }))
                                      }
                                      placeholder="Szukaj w bazie…"
                                      className="w-full rounded border border-border bg-surface py-0.5 pl-6 pr-1.5 text-[11px]"
                                      autoFocus={pickerRole === roleKey}
                                    />
                                  </div>
                                  <ul className="max-h-24 overflow-y-auto rounded border border-border">
                                    <li>
                                      <button
                                        type="button"
                                        disabled={creatingRole === roleKey}
                                        onClick={() => void createEquipmentForRole(roleKey)}
                                        className="flex w-full items-center gap-1 px-1.5 py-0.5 text-left text-[11px] text-primary hover:bg-surface-2 disabled:opacity-50"
                                      >
                                        <Plus size={11} />
                                        {creatingRole === roleKey
                                          ? 'Tworzenie…'
                                          : 'Dodaj nową pozycję do bazy'}
                                      </button>
                                    </li>
                                    {options.map((item: Equipment) => (
                                      <li key={item.id}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            patchDraft(roleKey, {
                                              action: 'map',
                                              equipmentId: item.id,
                                            })
                                            setPickerRole(null)
                                          }}
                                          className="w-full px-1.5 py-0.5 text-left text-[11px] hover:bg-surface-2"
                                        >
                                          {item.name}
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          ) : draft.action === 'skip' ? (
                            <span className="text-[10px] text-muted-foreground">
                              w planie tak, w zleceniu nie
                            </span>
                          ) : (
                            <span className="text-[10px] text-warning">ustaw Mapuj lub Pomiń</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded border border-border bg-background px-2 py-1.5">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Podgląd zlecenia
            </div>
            {preview.lines.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Brak wierszy — zmapuj role.</p>
            ) : (
              <ul className="space-y-0.5 text-xs">
                {preview.lines.map((line) => (
                  <li key={line.catalogKey} className="flex justify-between gap-2">
                    <span className="truncate">{line.equipment.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatMeters(line.quantity)} {line.unit}
                      {line.equipment.visibleInOffer === false ? ' · mag.' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {stagePlanApplyBlockingIssues(preview.issues).length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-[10px] text-warning">
                {stagePlanApplyBlockingIssues(preview.issues).map((issue, index) => (
                  <li key={`${issue.kind}-${index}`}>
                    {issue.kind === 'unmapped'
                      ? `Brak decyzji: ${issue.line.catalogKey}`
                      : issue.kind === 'duplicate_equipment'
                        ? `Ten sam sprzęt: ${issue.catalogKeys.join(', ')}`
                        : issue.kind === 'unit_mismatch'
                          ? `Jednostka: ${issue.line.catalogKey}`
                          : `Mapowanie bez sprzętu: ${
                              'line' in issue ? issue.line.catalogKey : ''
                            }`}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border px-2.5 py-1 text-xs"
          >
            Anuluj
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void save()}
            className="rounded border-2 border-primary px-2.5 py-1 text-xs font-medium text-primary disabled:opacity-50"
          >
            {saving ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>
  )
}
