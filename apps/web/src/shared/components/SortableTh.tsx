import { ChevronDown, ChevronUp } from 'lucide-react'

type SortDir = 'asc' | 'desc'

interface SortableThProps {
  label: string
  sortKey: string
  currentSort: string
  currentDir: SortDir
  onSort: (key: string) => void
  className?: string
}

export function SortableTh({ label, sortKey, currentSort, currentDir, onSort, className = '' }: SortableThProps) {
  const isActive = currentSort === sortKey
  return (
    <th className={`text-left py-2 px-3 font-medium text-sm ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 hover:text-primary transition-colors w-full text-left"
      >
        {label}
        {isActive ? (
          currentDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
        ) : (
          <span className="opacity-30"><ChevronDown size={14} /></span>
        )}
      </button>
    </th>
  )
}
