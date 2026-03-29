import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'

interface CategoryDropdownManagerProps {
  value: string
  categories: string[]
  onSelect: (value: string) => void
  onAdd: () => void
  onEdit: (category: string) => void
  onDelete: (category: string) => void
  className?: string
  allLabel?: string
}

export function CategoryDropdownManager({
  value,
  categories,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  className = '',
  allLabel = 'Wszystkie kategorie',
}: CategoryDropdownManagerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const label = value === 'all' ? allLabel : value

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="bg-background border border-border rounded px-2.5 py-1.5 text-sm min-w-[180px] flex items-center justify-between gap-2"
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-[280px] rounded border border-border bg-surface shadow-lg z-20 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              onSelect('all')
              setOpen(false)
            }}
            className="w-full px-2.5 py-2 text-sm flex items-center justify-between hover:bg-surface-2 transition-colors"
          >
            <span>{allLabel}</span>
            {value === 'all' ? <Check size={14} /> : null}
          </button>

          {categories.map((category) => (
            <div key={category} className="px-2.5 py-2 text-sm flex items-center justify-between gap-2 hover:bg-surface-2 transition-colors">
              <button
                type="button"
                onClick={() => {
                  onSelect(category)
                  setOpen(false)
                }}
                className="flex-1 text-left truncate"
              >
                {category}
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onEdit(category)
                  }}
                  className="p-1 text-primary hover:text-primary-hover"
                  title="Edytuj kategorię"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(category)
                  }}
                  className="p-1 text-red-500 hover:text-red-600"
                  title="Usuń kategorię"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          <div className="border-t border-border">
            <button
              type="button"
              onClick={() => {
                onAdd()
                setOpen(false)
              }}
              className="w-full px-2.5 py-2 text-sm flex items-center gap-2 hover:bg-surface-2 transition-colors text-primary"
            >
              <Plus size={14} />
              Dodaj kategorię
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
