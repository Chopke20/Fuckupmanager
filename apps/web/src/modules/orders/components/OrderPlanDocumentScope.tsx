export type PlanDocScope = 'order' | 'block' | 'item'

export interface PlanDocTreeItem {
  id: string
  label: string
  blockId: string | null
  itemId: string
  groupLabel: string
  preview: unknown
}

export function PlanScopeControls({
  scope,
  onScopeChange,
  selectedItemId,
  onSelectItem,
  items,
  itemNoun,
}: {
  scope: PlanDocScope
  onScopeChange: (scope: PlanDocScope) => void
  selectedItemId: string
  onSelectItem: (id: string) => void
  items: Array<{ id: string; label: string; groupLabel: string }>
  itemNoun: string
}) {
  const groups = new Map<string, Array<{ id: string; label: string }>>()
  for (const item of items) {
    const list = groups.get(item.groupLabel) ?? []
    list.push({ id: item.id, label: item.label })
    groups.set(item.groupLabel, list)
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 text-xs font-medium text-muted-foreground">Zakres PDF</div>
        <div className="inline-flex max-w-full flex-wrap overflow-hidden rounded-md border border-border">
          {(
            [
              ['order', 'Całe zlecenie'],
              ['block', 'Blok / wykaz'],
              ['item', itemNoun],
            ] as const
          ).map(([id, label], index) => (
            <button
              key={id}
              type="button"
              onClick={() => onScopeChange(id)}
              className={`px-2.5 py-1.5 text-xs ${index > 0 ? 'border-l border-border' : ''} ${
                scope === id
                  ? 'bg-primary/15 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-background hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {items.length > 0 ? (
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            {scope === 'order' ? 'Podgląd (wybierz pozycję)' : 'Wybór'}
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded border border-border p-2">
            {[...groups.entries()].map(([groupLabel, groupItems]) => (
              <div key={groupLabel}>
                <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {groupLabel}
                </div>
                <ul className="space-y-0.5">
                  {groupItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSelectItem(item.id)}
                        className={`w-full rounded px-2 py-1.5 text-left text-xs ${
                          selectedItemId === item.id
                            ? 'bg-primary/15 text-primary'
                            : 'hover:bg-background text-foreground'
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function describePlanScope(params: {
  scope: PlanDocScope
  itemCount: number
  groupCount: number
  selectedLabel?: string | null
  itemNounPlural: string
}): string {
  if (params.scope === 'order') {
    return `całe zlecenie · ${params.groupCount} grup · ${params.itemCount} ${params.itemNounPlural}`
  }
  if (params.scope === 'block') {
    return params.selectedLabel
      ? `blok/wykaz · ${params.selectedLabel}`
      : 'wybrany blok/wykaz'
  }
  return params.selectedLabel ? params.selectedLabel : `wybrany ${params.itemNounPlural.slice(0, -1)}`
}
