import { Plus, Trash2 } from 'lucide-react'
import { emptyBlockSection, type PlannerBlockSection } from '../planner/plannerTypes'

export default function PlannerBlockSectionsEditor({
  sections,
  onChange,
  compact = false,
}: {
  sections: PlannerBlockSection[]
  onChange: (next: PlannerBlockSection[]) => void
  compact?: boolean
}) {
  const updateText = (id: string, text: string) => {
    onChange(sections.map((s) => (s.id === id ? { ...s, text } : s)))
  }

  const remove = (id: string) => {
    onChange(sections.filter((s) => s.id !== id))
  }

  const add = () => {
    onChange([...sections, emptyBlockSection()])
  }

  return (
    <div className={`space-y-2 ${compact ? '' : ''}`}>
      {sections.length === 0 ? (
        <p className="text-xs text-muted-foreground">Brak sekcji — dodaj pierwszą.</p>
      ) : (
        sections.map((section, index) => (
          <div
            key={section.id}
            className="rounded border border-border bg-background p-2"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Sekcja {index + 1}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-red-400"
                onClick={() => remove(section.id)}
                aria-label={`Usuń sekcję ${index + 1}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
            <textarea
              className={`w-full resize-y rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary/50 ${
                compact ? 'min-h-[4rem]' : 'min-h-[5rem]'
              }`}
              value={section.text}
              placeholder="Treść sekcji…"
              onChange={(e) => updateText(section.id, e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        ))
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
