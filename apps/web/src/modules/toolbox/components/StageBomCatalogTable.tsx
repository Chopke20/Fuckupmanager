import { useEffect, useMemo, useState } from 'react'
import { Settings2 } from 'lucide-react'
import type { StagePlan, StagePlanRoleMap } from '@lama-stage/shared-types'
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

export default function StageBomCatalogTable({ plan }: { plan: StagePlan }) {
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
        action: item.action === 'attach' ? ('skip' as const) : item.action,
        equipmentId: item.action === 'map' ? item.equipmentId : null,
        attachToRoleKey: null,
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

  const isSkipped = (catalogKey: string) => {
    for (const key of stagePlanRoleLookupKeys(catalogKey)) {
      const row = maps.find((item) => item.roleKey === key)
      if (row?.action === 'skip' || row?.action === 'attach') return true
    }
    return false
  }

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
        <div className="text-xs font-medium">Rozpiska planu</div>
        <button
          type="button"
          onClick={() => setGearOpen(true)}
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${
            needsMappingSetup
              ? 'border-warning bg-warning/10 text-warning animate-pulse'
              : 'border-border text-muted-foreground hover:text-foreground'
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

      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 text-left text-xs text-muted-foreground">
              <th className="px-2 py-1.5 font-medium">Pozycja</th>
              <th className="px-2 py-1.5 text-right font-medium">Ilość</th>
              <th className="px-2 py-1.5 font-medium">W zleceniu</th>
            </tr>
          </thead>
          <tbody>
            {plan.bom.map((line) => {
              const mappedName = mappedByCatalogKey.get(line.catalogKey)
              const skipped = !mappedName && isSkipped(line.catalogKey)
              return (
                <tr key={line.catalogKey} className="border-t border-border/60">
                  <td className="px-2 py-1.5">
                    <div>{line.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {STAGE_PLAN_CATALOG_KEY_LABELS[line.catalogKey] ?? line.catalogKey}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatMeters(line.quantity)} {line.unit}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">
                    {mappedName
                      ? mappedName
                      : skipped
                        ? 'pominięte (tylko plan)'
                        : '— brak mapowania'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {preview.lines.length > 0 ? (
        <div className="rounded border border-border bg-background p-2 text-xs">
          <div className="mb-1 font-medium text-muted-foreground">Po apply do zlecenia:</div>
          <ul className="space-y-0.5">
            {preview.lines.map((line) => (
              <li key={line.catalogKey} className="flex justify-between gap-2">
                <span>{line.equipment.name}</span>
                <span className="tabular-nums">
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
