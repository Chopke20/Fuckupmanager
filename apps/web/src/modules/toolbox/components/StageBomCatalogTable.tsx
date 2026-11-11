import { useEffect, useMemo, useState } from 'react'
import { Settings2 } from 'lucide-react'
import type { ResolvedStageOrderLine, StagePlan, StagePlanRoleMap } from '@lama-stage/shared-types'
import {
  STAGE_PLAN_CATALOG_KEY_LABELS,
  formatMeters,
  resolveStagePlanOrderLines,
  stagePlanApplyBlockingIssues,
  stagePlanRoleLookupKeys,
} from '@lama-stage/shared-types'
import { useEquipment } from '../../equipment/hooks/useEquipment'
import { listStagePlanRoleMaps } from '../api/stagePlanRoleMaps.api'
import StagePlanRoleMapModal from './StagePlanRoleMapModal'

export type StageBomPreview = {
  lines: ResolvedStageOrderLine[]
  skippedCount: number
  unmappedOfferCount: number
  needsMappingSetup: boolean
  maps: StagePlanRoleMap[]
}

export default function StageBomCatalogTable({
  plan,
  onPreviewChange,
  hideApplyPreview = false,
}: {
  plan: StagePlan
  onPreviewChange?: (preview: StageBomPreview) => void
  hideApplyPreview?: boolean
}) {
  const { data: catalogPage } = useEquipment({ limit: 500 })
  const catalog = catalogPage?.data ?? []
  const [maps, setMaps] = useState<StagePlanRoleMap[]>([])
  const [gearOpen, setGearOpen] = useState(false)

  const refreshMaps = async () => {
    try {
      setMaps(await listStagePlanRoleMaps())
    } catch {
      setMaps([])
    }
  }

  useEffect(() => {
    void refreshMaps()
  }, [])

  const roleEntries = useMemo(
    () =>
      maps.map((item) => ({
        roleKey: item.roleKey,
        action: item.action,
        equipmentId: item.action === 'map' ? item.equipmentId : null,
        attachToRoleKey: item.action === 'attach' ? item.attachToRoleKey : null,
      })),
    [maps]
  )

  const preview = useMemo(
    () =>
      resolveStagePlanOrderLines({
        plan,
        maps: roleEntries,
        catalog,
      }),
    [plan, roleEntries, catalog]
  )

  const needsMappingSetup = useMemo(() => {
    if (plan.bom.length === 0) return false
    return stagePlanApplyBlockingIssues(preview.issues).length > 0 || maps.length === 0
  }, [plan.bom.length, preview.issues, maps.length])

  const mappedByCatalogKey = useMemo(() => {
    const out = new Map<string, string>()
    for (const line of preview.lines) {
      for (const key of line.sourceKeys) {
        out.set(key, line.equipment.name)
      }
    }
    return out
  }, [preview.lines])

  const attachedKeys = useMemo(() => {
    const out = new Set<string>()
    for (const map of maps) {
      if (map.action !== 'attach') continue
      out.add(map.roleKey)
    }
    return out
  }, [maps])

  const isSkipped = (catalogKey: string) => {
    for (const key of stagePlanRoleLookupKeys(catalogKey)) {
      const row = maps.find((item) => item.roleKey === key)
      if (row?.action === 'skip') return true
    }
    return false
  }

  const isAttached = (catalogKey: string) => {
    for (const key of stagePlanRoleLookupKeys(catalogKey)) {
      if (attachedKeys.has(key)) return true
    }
    return false
  }

  const skippedCount = useMemo(() => {
    return plan.bom.filter((line) => {
      if (mappedByCatalogKey.has(line.catalogKey)) return false
      return isSkipped(line.catalogKey) || isAttached(line.catalogKey)
    }).length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.bom, mappedByCatalogKey, maps])

  const unmappedOfferCount = useMemo(
    () =>
      preview.issues.filter(
        (issue) => issue.kind === 'unmapped' && issue.line.offer
      ).length,
    [preview.issues]
  )

  useEffect(() => {
    onPreviewChange?.({
      lines: preview.lines,
      skippedCount,
      unmappedOfferCount,
      needsMappingSetup,
      maps,
    })
  }, [
    onPreviewChange,
    preview.lines,
    skippedCount,
    unmappedOfferCount,
    needsMappingSetup,
    maps,
  ])

  if (plan.bom.length === 0) {
    return (
      <p className="px-2 py-3 text-xs text-muted-foreground">
        Ułóż podesty na rzucie, żeby zobaczyć wykaz.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-foreground">Rozpiska</div>
        <button
          type="button"
          onClick={() => setGearOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium ${
            needsMappingSetup
              ? 'border-warning bg-warning/15 text-warning'
              : 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/15'
          }`}
          title={
            needsMappingSetup
              ? 'Ustaw mapowanie ról na sprzęt — wymagane przed dodaniem do zlecenia'
              : 'Mapowanie ról na sprzęt'
          }
        >
          <Settings2 size={14} />
          Mapowanie
          {needsMappingSetup ? ' · ustaw' : ''}
        </button>
      </div>

      {needsMappingSetup ? (
        <p className="rounded border border-warning/40 bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
          Część pozycji oferty nie ma mapowania — otwórz Mapowanie przed dodaniem do zlecenia.
        </p>
      ) : null}

      <div className="max-h-[min(48vh,420px)] overflow-auto rounded border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-2 py-1.5 font-medium">Pozycja</th>
              <th className="w-24 whitespace-nowrap px-2 py-1.5 text-right font-medium">
                Ilość
              </th>
              <th className="px-2 py-1.5 font-medium">W zleceniu</th>
            </tr>
          </thead>
          <tbody>
            {plan.bom.map((line) => {
              const mappedName = mappedByCatalogKey.get(line.catalogKey)
              const catalogLabel =
                STAGE_PLAN_CATALOG_KEY_LABELS[line.catalogKey] ?? line.catalogKey
              const showSub =
                catalogLabel.trim().toLowerCase() !== line.name.trim().toLowerCase() &&
                !line.name.toLowerCase().includes(catalogLabel.toLowerCase())
              const attached = !mappedName && isAttached(line.catalogKey)
              const skipped = !mappedName && !attached && isSkipped(line.catalogKey)

              return (
                <tr key={line.catalogKey} className="border-t border-border/60">
                  <td className="px-2 py-1.5">
                    <div className="leading-snug">{line.name}</div>
                    {showSub ? (
                      <div className="text-[10px] text-muted-foreground">{catalogLabel}</div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                    {formatMeters(line.quantity)}&nbsp;{line.unit}
                  </td>
                  <td className="px-2 py-1.5 text-xs">
                    {mappedName ? (
                      <span className="text-primary">
                        ✓ w zleceniu
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          {mappedName}
                        </span>
                      </span>
                    ) : attached ? (
                      <span className="text-muted-foreground">wliczone w podest</span>
                    ) : skipped ? (
                      <span className="text-muted-foreground/70">tylko plan</span>
                    ) : (
                      <span className="text-warning">— brak mapowania</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!hideApplyPreview && preview.lines.length > 0 ? (
        <div className="rounded border border-border bg-background p-2 text-xs">
          <div className="mb-1 font-medium text-muted-foreground">Po zastosowaniu</div>
          <ul className="space-y-0.5">
            {preview.lines.map((line) => (
              <li key={line.catalogKey} className="flex justify-between gap-2">
                <span>{line.equipment.name}</span>
                <span className="whitespace-nowrap tabular-nums">
                  {formatMeters(line.quantity)} {line.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <StagePlanRoleMapModal
        open={gearOpen}
        plan={plan}
        onClose={() => setGearOpen(false)}
        onSaved={(saved) => setMaps(saved)}
      />
    </div>
  )
}
