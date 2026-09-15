import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Settings2, X } from 'lucide-react'
import type {
  Equipment,
  StageBomLine,
  StagePlan,
  StagePlanRoleAction,
  StagePlanRoleMap,
  UpsertStagePlanRoleMapDto,
} from '@lama-stage/shared-types'
import {
  STAGE_PLAN_CATALOG_KEY_LABELS,
  STAGE_PLAN_ROLE_CONFIG_KEYS,
  formatMeters,
  resolveStagePlanOrderLines,
} from '@lama-stage/shared-types'
import { useEquipment } from '../../equipment/hooks/useEquipment'
import { equipmentApi } from '../../equipment/api/equipment.api'
import {
  bulkUpsertStagePlanRoleMaps,
  listStagePlanRoleMaps,
} from '../api/stagePlanRoleMaps.api'

type DraftRow = {
  roleKey: string
  action: StagePlanRoleAction
  equipmentId: string | null
  attachToRoleKey: string | null
}

function emptyDraft(roleKey: string): DraftRow {
  return { roleKey, action: 'skip', equipmentId: null, attachToRoleKey: null }
}

function draftsFromMaps(maps: StagePlanRoleMap[]): Record<string, DraftRow> {
  const out: Record<string, DraftRow> = {}
  for (const key of STAGE_PLAN_ROLE_CONFIG_KEYS) {
    out[key] = emptyDraft(key)
  }
  for (const map of maps) {
    out[map.roleKey] = {
      roleKey: map.roleKey,
      action: map.action,
      equipmentId: map.equipmentId ?? null,
      attachToRoleKey: map.attachToRoleKey ?? null,
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
    if (open) void load()
  }, [open, load])

  const roleMapsEntries = useMemo(
    () =>
      Object.values(drafts).map((row) => ({
        roleKey: row.roleKey,
        action: row.action,
        equipmentId: row.equipmentId,
        attachToRoleKey: row.attachToRoleKey,
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

  const hostOptions = STAGE_PLAN_ROLE_CONFIG_KEYS.filter((key) => key !== 'legs' && key !== 'stairs')

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
        name: STAGE_PLAN_CATALOG_KEY_LABELS[roleKey] ?? bomDisplayName(sample ?? { name: roleKey } as StageBomLine),
        category: 'Scena',
        unit: sample?.unit ?? 'szt.',
        dailyPrice: 0,
        stockQuantity: 1,
        visibleInOffer: sample?.offer ?? true,
        internalCode: proposedCode,
        pricingRule: { day1: 1.0, nextDays: 0.5 },
      })
      await refetchCatalog()
      patchDraft(roleKey, { action: 'map', equipmentId: created.id, attachToRoleKey: null })
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
      const maps: UpsertStagePlanRoleMapDto[] = Object.values(drafts).map((row) => ({
        roleKey: row.roleKey,
        action: row.action,
        equipmentId: row.action === 'map' ? row.equipmentId : null,
        attachToRoleKey: row.action === 'attach' ? row.attachToRoleKey : null,
      }))
      const saved = await bulkUpsertStagePlanRoleMaps(maps)
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
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Settings2 size={18} />
            <h2 className="text-lg font-bold">Mapowanie ról kreatora → sprzęt</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border p-1 text-muted-foreground hover:text-foreground"
            aria-label="Zamknij"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Przepis jest wspólny dla całej firmy. Kreator liczy szczegółowy BOM; tu ustalasz, które
            pozycje z bazy trafiają do zlecenia, które się dołączają (bez sumowania ilości), a które
            pomijamy.
          </p>

          {error ? (
            <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">Wczytywanie…</p>
          ) : (
            <div className="space-y-2">
              {STAGE_PLAN_ROLE_CONFIG_KEYS.map((roleKey) => {
                const draft = drafts[roleKey] ?? emptyDraft(roleKey)
                const qty = quantityForRole(plan, roleKey)
                const query = (searchByRole[roleKey] ?? '').trim().toLowerCase()
                const options = catalog
                  .filter((item) => item.category !== 'ZASOBY')
                  .filter((item) => !query || item.name.toLowerCase().includes(query))
                  .slice(0, 20)
                const selected = catalog.find((item) => item.id === draft.equipmentId)

                return (
                  <div
                    key={roleKey}
                    className="rounded border border-border bg-background p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">
                          {STAGE_PLAN_CATALOG_KEY_LABELS[roleKey] ?? roleKey}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{roleKey}</div>
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {qty
                          ? `w tym planie: ${formatMeters(qty.quantity)} ${qty.unit}`
                          : 'brak w tym planie'}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          ['map', 'Mapuj na sprzęt'],
                          ['attach', 'Dołącz do roli'],
                          ['skip', 'Nie dodawaj'],
                        ] as const
                      ).map(([action, label]) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() =>
                            patchDraft(roleKey, {
                              action,
                              equipmentId: action === 'map' ? draft.equipmentId : null,
                              attachToRoleKey: action === 'attach' ? draft.attachToRoleKey : null,
                            })
                          }
                          className={`rounded border px-2 py-1 text-xs ${
                            draft.action === action
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {draft.action === 'map' ? (
                      <div className="space-y-1.5">
                        {selected ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded border border-border px-2 py-1">
                              {selected.name} · {selected.dailyPrice} zł ·{' '}
                              {selected.visibleInOffer !== false ? 'w ofercie' : 'tylko magazyn'}
                            </span>
                            <button
                              type="button"
                              onClick={() => patchDraft(roleKey, { equipmentId: null })}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              Zmień
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <Search
                                size={12}
                                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
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
                                placeholder="Szukaj w bazie sprzętu…"
                                className="w-full rounded border border-border bg-surface py-1 pl-7 pr-2 text-xs"
                              />
                            </div>
                            <ul className="max-h-28 overflow-y-auto rounded border border-border">
                              {options.map((item: Equipment) => (
                                <li key={item.id}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      patchDraft(roleKey, {
                                        action: 'map',
                                        equipmentId: item.id,
                                        attachToRoleKey: null,
                                      })
                                    }
                                    className="w-full px-2 py-1 text-left text-xs hover:bg-surface-2"
                                  >
                                    {item.name}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                        <button
                          type="button"
                          disabled={creatingRole === roleKey}
                          onClick={() => void createEquipmentForRole(roleKey)}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] hover:bg-surface-2 disabled:opacity-50"
                        >
                          <Plus size={11} />
                          {creatingRole === roleKey ? 'Tworzenie…' : 'Utwórz w bazie sprzętu'}
                        </button>
                      </div>
                    ) : null}

                    {draft.action === 'attach' ? (
                      <select
                        value={draft.attachToRoleKey ?? ''}
                        onChange={(e) =>
                          patchDraft(roleKey, {
                            action: 'attach',
                            attachToRoleKey: e.target.value || null,
                            equipmentId: null,
                          })
                        }
                        className="w-full max-w-md rounded border border-border bg-surface px-2 py-1 text-xs"
                      >
                        <option value="">— wybierz rolę gospodarza —</option>
                        {hostOptions
                          .filter((key) => key !== roleKey)
                          .map((key) => (
                            <option key={key} value={key}>
                              {STAGE_PLAN_CATALOG_KEY_LABELS[key] ?? key}
                            </option>
                          ))}
                      </select>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}

          <div className="rounded border border-border bg-background p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Podgląd wierszy zlecenia
            </div>
            {preview.lines.length === 0 ? (
              <p className="text-xs text-muted-foreground">Brak wierszy — zmapuj role albo sprawdź plan.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {preview.lines.map((line) => (
                  <li key={line.catalogKey} className="flex justify-between gap-2">
                    <span>
                      {line.equipment.name}
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({line.sourceKeys.join(', ')})
                      </span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatMeters(line.quantity)} {line.unit}
                      {line.equipment.visibleInOffer === false ? ' · magazyn' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {preview.issues.length > 0 ? (
              <ul className="mt-2 space-y-0.5 text-[11px] text-warning">
                {preview.issues.map((issue, index) => (
                  <li key={`${issue.kind}-${index}`}>
                    {issue.kind === 'unmapped'
                      ? `Brak mapowania: ${issue.line.catalogKey}`
                      : issue.kind === 'duplicate_equipment'
                        ? `Ten sam sprzęt dla ról: ${issue.catalogKeys.join(', ')}`
                        : issue.kind === 'unit_mismatch'
                          ? `Jednostka: ${issue.line.catalogKey} (${issue.line.unit} ≠ ${issue.equipment.unit})`
                          : issue.kind === 'attach_target_missing'
                            ? `Dołączenie ${issue.line.catalogKey} → brak gospodarza ${issue.attachToRoleKey}`
                            : `Mapowanie bez sprzętu: ${issue.line.catalogKey}`}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
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
            disabled={saving || loading}
            onClick={() => void save()}
            className="rounded border-2 border-primary px-3 py-1.5 text-xs font-medium text-primary disabled:opacity-50"
          >
            {saving ? 'Zapisywanie…' : 'Zapisz przepis'}
          </button>
        </div>
      </div>
    </div>
  )
}
