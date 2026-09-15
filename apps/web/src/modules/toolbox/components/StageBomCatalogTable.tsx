import { useEffect, useMemo, useState } from 'react'
import { Settings2 } from 'lucide-react'
import type { StagePlan, StagePlanRoleMap } from '@lama-stage/shared-types'
import {
  STAGE_PLAN_CATALOG_KEY_LABELS,
  formatMeters,
  resolveStagePlanOrderLines,
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

  const preview = useMemo(
    () =>
      resolveStagePlanOrderLines({
        plan,
        maps: maps.map((item) => ({
          roleKey: item.roleKey,
          action: item.action,
          equipmentId: item.equipmentId,
          attachToRoleKey: item.attachToRoleKey,
        })),
        catalog,
      }),
    [plan, maps, catalog]
  )

  const mappedByCatalogKey = useMemo(() => {
    const out = new Map<string, string>()
    for (const line of preview.lines) {
      for (const key of line.sourceKeys) {
        out.set(key, line.equipment.name)
      }
    }
    return out
  }, [preview.lines])

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
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          title="Mapowanie ról na sprzęt"
        >
          <Settings2 size={14} />
          Mapowanie
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
              const skipped = !mappedName && maps.some((m) => {
                if (m.action !== 'skip') return false
                return m.roleKey === line.catalogKey || m.roleKey === line.catalogKey.split('-')[0]
              })
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
                        ? 'pominięte'
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
