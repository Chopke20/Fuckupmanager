import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Link2, Plus } from 'lucide-react'
import type { Equipment, StageBomLine, StagePlan } from '@lama-stage/shared-types'
import { STAGE_PLAN_CATALOG_KEY_LABELS, formatMeters } from '@lama-stage/shared-types'
import { useEquipment, useUpdateEquipment } from '../../equipment/hooks/useEquipment'
import { equipmentApi } from '../../equipment/api/equipment.api'
import { buildStageCatalogMap } from '../utils/applyStagePlanToOrder'

function bomDisplayName(line: StageBomLine): string {
  return line.name.replace(/\s*\([^)]*\)\s*$/, '').trim() || line.name
}

export default function StageBomCatalogTable({ plan }: { plan: StagePlan }) {
  const { data: catalogPage, refetch } = useEquipment({ limit: 500 })
  const updateEquipment = useUpdateEquipment()
  const catalog = catalogPage?.data ?? []
  const byKey = useMemo(() => buildStageCatalogMap(catalog), [catalog])
  const [linkKey, setLinkKey] = useState<string | null>(null)
  const [linkSearch, setLinkSearch] = useState('')
  const priceTimers = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    return () => {
      for (const timer of priceTimers.current.values()) {
        window.clearTimeout(timer)
      }
    }
  }, [])

  const schedulePriceUpdate = (equipmentId: string, dailyPrice: number) => {
    const existing = priceTimers.current.get(equipmentId)
    if (existing != null) window.clearTimeout(existing)
    const timer = window.setTimeout(() => {
      priceTimers.current.delete(equipmentId)
      void updateEquipment.mutateAsync({ id: equipmentId, data: { dailyPrice } })
    }, 600)
    priceTimers.current.set(equipmentId, timer)
  }

  const createInCatalog = async (line: StageBomLine) => {
    const { proposedCode } = await equipmentApi.getNextCode('Scena')
    await equipmentApi.create({
      name: bomDisplayName(line),
      category: 'Scena',
      unit: line.unit,
      dailyPrice: 0,
      stockQuantity: 1,
      visibleInOffer: line.offer,
      stagePlanKey: line.catalogKey,
      internalCode: proposedCode,
      pricingRule: { day1: 1.0, nextDays: 0.5 },
    })
    await refetch()
  }

  const linkToExisting = async (line: StageBomLine, equipment: Equipment) => {
    await equipmentApi.update(equipment.id, { stagePlanKey: line.catalogKey })
    await refetch()
    setLinkKey(null)
    setLinkSearch('')
  }

  const filteredLinkOptions = useMemo(() => {
    const query = linkSearch.trim().toLowerCase()
    return catalog
      .filter((item) => item.category !== 'ZASOBY')
      .filter((item) => !item.stagePlanKey || item.stagePlanKey === linkKey)
      .filter((item) => !query || item.name.toLowerCase().includes(query))
      .slice(0, 12)
  }, [catalog, linkKey, linkSearch])

  if (plan.bom.length === 0) {
    return (
      <p className="px-2 py-3 text-xs text-muted-foreground">
        Ułóż podesty na rzucie, żeby zobaczyć wykaz.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-2 text-left text-xs text-muted-foreground">
            <th className="px-2 py-1.5 font-medium">Pozycja</th>
            <th className="px-2 py-1.5 text-right font-medium">Ilość</th>
            <th className="px-2 py-1.5 font-medium">Baza sprzętu</th>
            <th className="px-2 py-1.5 text-right font-medium">Cena</th>
            <th className="px-2 py-1.5 text-center font-medium">W ofercie</th>
          </tr>
        </thead>
        <tbody>
          {plan.bom.map((line) => {
            const equipment = byKey.get(line.catalogKey)
            const unitMismatch =
              equipment && (equipment.unit || 'szt.').trim() !== line.unit
            const unmapped = !equipment
            return (
              <tr
                key={line.catalogKey}
                className={`border-t border-border/60 ${unmapped && line.offer ? 'bg-red-500/5' : ''}`}
              >
                <td className="px-2 py-1.5">
                  <div>{line.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {STAGE_PLAN_CATALOG_KEY_LABELS[line.catalogKey] ?? line.catalogKey}
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatMeters(line.quantity)} {line.unit}
                </td>
                <td className="px-2 py-1.5">
                  {equipment ? (
                    <div>
                      <div className="text-xs">{equipment.name}</div>
                      {unitMismatch ? (
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-warning">
                          <AlertTriangle size={11} />
                          katalog: {equipment.unit}, plan: {line.unit}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => void createInCatalog(line)}
                        className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-surface-2"
                      >
                        <Plus size={11} />
                        Utwórz
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLinkKey(line.catalogKey)
                          setLinkSearch('')
                        }}
                        className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-surface-2"
                      >
                        <Link2 size={11} />
                        Wskaż
                      </button>
                    </div>
                  )}
                  {linkKey === line.catalogKey ? (
                    <div className="mt-1 space-y-1 rounded border border-border bg-background p-1.5">
                      <input
                        type="text"
                        value={linkSearch}
                        onChange={(event) => setLinkSearch(event.target.value)}
                        placeholder="Szukaj w katalogu…"
                        className="w-full rounded border border-border bg-surface px-1.5 py-0.5 text-[10px]"
                      />
                      <ul className="max-h-24 overflow-y-auto">
                        {filteredLinkOptions.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => void linkToExisting(line, item)}
                              className="w-full px-1 py-0.5 text-left text-[10px] hover:bg-surface-2"
                            >
                              {item.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => setLinkKey(null)}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Anuluj
                      </button>
                    </div>
                  ) : null}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {equipment ? (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={equipment.dailyPrice}
                      key={`${equipment.id}-${equipment.dailyPrice}`}
                      onChange={(event) =>
                        schedulePriceUpdate(equipment.id, Number(event.target.value) || 0)
                      }
                      className="w-16 rounded border border-border bg-background px-1 py-0.5 text-right text-xs tabular-nums"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-center">
                  {equipment ? (
                    <input
                      type="checkbox"
                      checked={equipment.visibleInOffer !== false}
                      onChange={(event) =>
                        void updateEquipment.mutateAsync({
                          id: equipment.id,
                          data: { visibleInOffer: event.target.checked },
                        })
                      }
                      title="Widoczne dla klienta w ofercie"
                      aria-label={`${line.name} — widoczne w ofercie`}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
