import { Plus, Trash2 } from 'lucide-react'
import {
  emptyBlockSection,
  sectionAccentColor,
  type PlannerBlockSection,
} from '../planner/plannerTypes'

export default function PlannerBlockSectionsEditor({
  sections,
  onChange,
  compact = false,
}: {
  sections: PlannerBlockSection[]
  onChange: (next: PlannerBlockSection[]) => void
  compact?: boolean
}) {
  const update = (id: string, patch: Partial<Pick<PlannerBlockSection, 'title' | 'text'>>) => {
    onChange(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const remove = (id: string) => {
    onChange(sections.filter((s) => s.id !== id))
  }

  const add = () => {
    onChange([...sections, emptyBlockSection()])
  }

  return (
    <div className="space-y-2">
      {sections.length === 0 ? (
        <p className="text-xs text-muted-foreground">Brak sekcji — dodaj pierwszą.</p>
      ) : (
        sections.map((section, index) => {
          const accent = sectionAccentColor(index)
          return (
            <div
              key={section.id}
              className="rounded border border-border bg-background p-2"
              style={{ borderLeftWidth: 4, borderLeftColor: accent }}
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                <input
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none placeholder:text-muted-foreground"
                  value={section.title}
                  placeholder={`Sekcja ${index + 1}`}
                  onChange={(e) => update(section.id, { title: e.target.value })}
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground hover:text-red-400"
                  onClick={() => remove(section.id)}
                  aria-label={`Usuń sekcję ${index + 1}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <textarea
                className={`w-full resize-y rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary/50 ${
                  compact ? 'min-h-[3.5rem]' : 'min-h-[5rem]'
                }`}
                value={section.text}
                placeholder="Treść…"
                onChange={(e) => update(section.id, { text: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
              />
            </div>
          )
        })
      )}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 rounded border border-dashed border-border px-2 py-1.5 text-xs hover:border-primary/40"
      >
        <Plus size={12} /> Dodaj sekcję
      </button>
    </div>
  )
}
