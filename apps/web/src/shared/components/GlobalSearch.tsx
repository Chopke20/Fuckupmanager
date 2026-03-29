import { useState, useEffect, useRef } from 'react'
import { Search, X, FileText, Building, Package, Box, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { orderApi } from '../../modules/orders/api/order.api'
import { clientApi } from '../../modules/clients/api/client.api'
import { equipmentApi } from '../../modules/equipment/api/equipment.api'

interface SearchResult {
  id: string
  type: 'order' | 'client' | 'equipment' | 'resource'
  title: string
  subtitle: string
  icon: React.ReactNode
  url: string
}

const LIMIT = 12

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q === '') {
      setResults([])
      return
    }

    let cancelled = false
    setIsLoading(true)

    const run = async () => {
      try {
        const [ordersSettled, clientsSettled, equipmentSettled, resourcesSettled] = await Promise.allSettled([
          orderApi.getAll({ search: q, page: 1, limit: LIMIT }),
          clientApi.getAll({ search: q, page: 1, limit: LIMIT }),
          equipmentApi.getAll({ search: q, page: 1, limit: LIMIT }),
          equipmentApi.getAll({ search: q, category: 'ZASOBY', page: 1, limit: LIMIT }),
        ])

        if (cancelled) return

        const ordersRes = ordersSettled.status === 'fulfilled' ? ordersSettled.value : null
        const clientsRes = clientsSettled.status === 'fulfilled' ? clientsSettled.value : null
        const equipmentRes = equipmentSettled.status === 'fulfilled' ? equipmentSettled.value : null
        const resourcesRes = resourcesSettled.status === 'fulfilled' ? resourcesSettled.value : null

        const newResults: SearchResult[] = []

        const orders = ordersRes?.data ?? []
        orders.forEach((order: { id: string; name: string; client?: { companyName?: string }; dateFrom?: string; status?: string }) => {
          const clientName = order.client && typeof order.client === 'object' && 'companyName' in order.client
            ? (order.client as { companyName?: string }).companyName
            : ''
          const dateStr = order.dateFrom ? format(new Date(order.dateFrom), 'dd.MM.yyyy') : ''
          newResults.push({
            id: order.id,
            type: 'order',
            title: order.name || 'Zlecenie',
            subtitle: [clientName, dateStr].filter(Boolean).join(' • ') || (order.status ?? ''),
            icon: <FileText size={16} className="text-blue-500" />,
            url: `/orders/${order.id}`,
          })
        })

        const clients = clientsRes?.data ?? []
        clients.forEach((client: { id: string; companyName: string; contactName?: string; email?: string }) => {
          newResults.push({
            id: client.id,
            type: 'client',
            title: client.companyName,
            subtitle: client.contactName || client.email || '',
            icon: <Building size={16} className="text-green-500" />,
            url: `/clients?edit=${client.id}`,
          })
        })

        const equipment = equipmentRes?.data ?? []
        equipment.forEach((eq: { id: string; name: string; category: string; dailyPrice: number }) => {
          newResults.push({
            id: eq.id,
            type: 'equipment',
            title: eq.name,
            subtitle: `${eq.category} • ${eq.dailyPrice?.toFixed(2) ?? 0} PLN/dzień`,
            icon: <Package size={16} className="text-purple-500" />,
            url: `/equipment?edit=${eq.id}`,
          })
        })

        const resources = resourcesRes?.data ?? []
        resources.forEach((res: { id: string; name: string; description?: string; dailyPrice: number }) => {
          const sub = res.description?.replace(/Kategoria:\s*/i, '') || 'Zasób'
          newResults.push({
            id: res.id,
            type: 'resource',
            title: res.name,
            subtitle: `${sub} • ${res.dailyPrice?.toFixed(2) ?? 0} PLN/dzień`,
            icon: <Box size={16} className="text-amber-500" />,
            url: `/resources?edit=${res.id}`,
          })
        })

        setResults(newResults)
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    const t = setTimeout(run, 280)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const handleResultClick = (result: SearchResult) => {
    navigate(result.url)
    setIsOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
    if (e.key === 'Enter' && results.length > 0) {
      const firstResult = results[0]
      if (firstResult) {
        handleResultClick(firstResult)
      }
    }
  }

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'order': return 'Zlecenie'
      case 'client': return 'Klient'
      case 'equipment': return 'Sprzęt'
      case 'resource': return 'Zasób'
      default: return ''
    }
  }

  return (
    <div className="relative" ref={searchRef}>
      {/* Przycisk wyszukiwania */}
      <button
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 100)
        }}
        className="w-full flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors text-muted-foreground hover:text-foreground text-left"
      >
        <Search size={18} className="shrink-0" />
        <span className="truncate">Szukaj zleceń, klientów, sprzętu, zasobów...</span>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setIsOpen(false)} />
      )}

      {/* Modal wyszukiwania */}
      {isOpen && (
        <div className="fixed inset-x-0 top-20 z-50 mx-auto max-w-2xl">
          <div className="bg-surface rounded-xl border border-border shadow-2xl overflow-hidden">
            {/* Pole wyszukiwania */}
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Szukaj zleceń, klientów, sprzętu, zasobów..."
                  className="w-full pl-10 pr-10 py-3 bg-surface-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Wyniki */}
            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-4">Wyszukiwanie...</p>
                </div>
              ) : results.length > 0 ? (
                <div className="divide-y divide-border">
                  {results.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className="w-full p-4 text-left hover:bg-surface-2 transition-colors flex items-center gap-3 group"
                    >
                      <div className="flex-shrink-0">
                        {result.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{result.title}</span>
                          <span className="text-xs px-2 py-0.5 bg-surface-3 rounded">
                            {getTypeLabel(result.type)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                      </div>
                      <ArrowRight size={16} className="text-muted-foreground group-hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              ) : query ? (
                <div className="p-8 text-center">
                  <Search size={48} className="mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Brak wyników dla "{query}"</p>
                  <p className="text-sm text-muted-foreground mt-2">Spróbuj innych słów kluczowych</p>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Search size={48} className="mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Wpisz czego szukasz...</p>
                  <div className="grid grid-cols-4 gap-3 mt-6">
                    <div className="text-center">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <FileText size={20} className="text-blue-500" />
                      </div>
                      <p className="text-sm">Zlecenia</p>
                    </div>
                    <div className="text-center">
                      <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Building size={20} className="text-green-500" />
                      </div>
                      <p className="text-sm">Klienci</p>
                    </div>
                    <div className="text-center">
                      <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Package size={20} className="text-purple-500" />
                      </div>
                      <p className="text-sm">Sprzęt</p>
                    </div>
                    <div className="text-center">
                      <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Box size={20} className="text-amber-500" />
                      </div>
                      <p className="text-sm">Zasoby</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Skróty klawiszowe */}
            <div className="p-3 border-t border-border bg-surface-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-surface-3 rounded">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-surface-3 rounded">↓</kbd>
                    <span>nawigacja</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-surface-3 rounded">Enter</kbd>
                    <span>wybierz</span>
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-surface-3 rounded">Esc</kbd>
                  <span>zamknij</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}