import { Plus, Search, Pencil, FileText, Trash2 } from 'lucide-react'
import { useOrders, useDeleteOrder } from '../hooks/useOrders'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useState, useMemo, useEffect } from 'react'
import { SortableTh } from '../../../shared/components/SortableTh'
import { ORDER_STATUSES, Order, calculateOrderNetValue } from '@lama-stage/shared-types'
import { formatOrderNumber } from '../utils/orderNumberFormat'

const statusColors: Record<typeof ORDER_STATUSES[number], string> = {
  DRAFT: 'bg-gray-500/20 text-gray-500',
  OFFER_SENT: 'bg-blue-500/20 text-blue-500',
  CONFIRMED: 'bg-green-500/20 text-green-500',
  COMPLETED: 'bg-purple-500/20 text-purple-500',
  CANCELLED: 'bg-red-500/20 text-red-500',
  ARCHIVED: 'bg-gray-300/20 text-gray-300',
}

const statusLabels: Record<typeof ORDER_STATUSES[number], string> = {
  DRAFT: 'Szkic',
  OFFER_SENT: 'Oferta wysłana',
  CONFIRMED: 'Potwierdzone',
  COMPLETED: 'Zakończone',
  CANCELLED: 'Anulowane',
  ARCHIVED: 'Zarchiwizowane',
}

const VALID_STATUSES: Array<Order['status'] | 'all'> = ['all', 'DRAFT', 'OFFER_SENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'ARCHIVED']

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFromUrl = searchParams.get('status')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<Order['status'] | 'all'>(() =>
    statusFromUrl && VALID_STATUSES.includes(statusFromUrl as any) ? (statusFromUrl as Order['status']) : 'all'
  )

  useEffect(() => {
    if (statusFromUrl && VALID_STATUSES.includes(statusFromUrl as any) && statusFilter !== statusFromUrl) {
      setStatusFilter(statusFromUrl as Order['status'])
    }
  }, [statusFromUrl])

  const handleStatusFilterChange = (value: Order['status'] | 'all') => {
    setStatusFilter(value)
    if (value === 'all') {
      searchParams.delete('status')
    } else {
      searchParams.set('status', value)
    }
    setSearchParams(searchParams, { replace: true })
  }

  const { data: paginatedOrders, isLoading, error } = useOrders({
    page,
    limit,
    search: searchTerm,
    status: statusFilter,
  })
  const deleteMutation = useDeleteOrder()

  const ordersRaw = paginatedOrders?.data ?? []
  const meta = paginatedOrders?.meta

  const [sortBy, setSortBy] = useState<string>('dateFrom')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const toggleSort = (key: string) => {
    setSortBy(key)
    setSortDir((d) => (sortBy === key ? (d === 'asc' ? 'desc' : 'asc') : key === 'dateFrom' ? 'desc' : 'asc'))
  }
  const orders = useMemo(() => {
    const list = [...ordersRaw]
    const mult = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortBy === 'name') return mult * (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'client') return mult * (a.client?.companyName || '').localeCompare(b.client?.companyName || '')
      if (sortBy === 'dateFrom') {
        const at = new Date((a as any).dateFrom || a.startDate || 0).getTime()
        const bt = new Date((b as any).dateFrom || b.startDate || 0).getTime()
        return mult * (at - bt)
      }
      if (sortBy === 'status') return mult * (a.status || '').localeCompare(b.status || '')
      return 0
    })
    return list
  }, [ordersRaw, sortBy, sortDir])

  const handleDelete = async (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć to zlecenie? Zlecenie trafi do kosza.')) {
      await deleteMutation.mutateAsync(id)
    }
  }


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Ładowanie zleceń...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p className="text-red-500">Błąd podczas ładowania zleceń</p>
        <p className="text-sm text-red-500/80 mt-1">Spróbuj odświeżyć stronę</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zlecenia</h1>
        <Link
          to="/orders/new"
          className="flex items-center gap-2 px-3 py-1.5 border-2 border-primary text-primary bg-transparent text-sm rounded hover:bg-primary/10 transition-colors"
        >
          <Plus size={16} />
          Nowe zlecenie
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Szukaj po nazwie, kliencie lub miejscu..."
            className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-2.5 py-1.5 bg-background border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value as Order['status'] | 'all')}
        >
          <option value="all">Wszystkie statusy</option>
          <option value="DRAFT">Szkic</option>
          <option value="OFFER_SENT">Oferta wysłana</option>
          <option value="CONFIRMED">Potwierdzone</option>
          <option value="COMPLETED">Zakończone</option>
          <option value="CANCELLED">Anulowane</option>
          <option value="ARCHIVED">Zarchiwizowane</option>
        </select>
        <button
          onClick={() => {
            setSearchTerm('')
            handleStatusFilterChange('all')
          }}
          className="px-2.5 py-1.5 border border-border rounded text-sm hover:bg-surface-2 transition-colors"
        >
          Wyczyść
        </button>
      </div>

      <div className="border border-border rounded overflow-hidden">
        {orders && orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-2 border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-sm w-24">Numer</th>
                  <SortableTh label="Nazwa zlecenia" sortKey="name" currentSort={sortBy} currentDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Klient" sortKey="client" currentSort={sortBy} currentDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Data" sortKey="dateFrom" currentSort={sortBy} currentDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Status" sortKey="status" currentSort={sortBy} currentDir={sortDir} onSort={toggleSort} />
                  <th className="text-left py-2 px-3 font-medium text-sm">Wartość netto</th>
                  <th className="text-left py-2 px-3 font-medium text-sm">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order: Order) => {
                  const netValue = calculateOrderNetValue(order)
                  const orderNum = formatOrderNumber((order as any).orderNumber, (order as any).orderYear)
                  return (
                    <tr key={order.id} className="border-b border-border hover:bg-surface-2/30 transition-colors">
                      <td className="py-2 px-3 text-muted-foreground font-mono text-sm">
                        {orderNum}
                      </td>
                      <td className="py-2 px-3">
                        <div>
                          <div className="font-medium">{order.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {order.venue || 'Brak miejsca'}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium">{order.client?.companyName || 'Brak klienta'}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {order.client?.contactName || ''}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-sm">
                          {format(new Date((order as any).dateFrom || order.startDate), 'dd.MM.yyyy', { locale: pl })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date((order as any).dateTo || order.endDate), 'dd.MM.yyyy', { locale: pl })}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${(statusColors as Record<string, string>)[order.status] || 'bg-gray-500/20 text-gray-500'}`}
                        >
                          {(statusLabels as Record<string, string>)[order.status] || order.status}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium">
                          {netValue.toLocaleString('pl')} PLN
                        </div>
                        <div className="text-xs text-muted-foreground">
                          netto
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/orders/${order.id}`}
                            className="p-1 hover:bg-surface-3 rounded transition-colors"
                            title="Edytuj"
                          >
                            <Pencil size={16} className="text-primary" />
                          </Link>
                          <button
                            className="p-1 hover:bg-surface-3 rounded transition-colors"
                            title="Generuj ofertę"
                          >
                            <FileText size={16} className="text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(order.id)}
                            className="p-1 hover:bg-surface-3 rounded transition-colors"
                            title="Usuń (do kosza)"
                          >
                            <Trash2 size={16} className="text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="p-3 flex justify-between items-center border-t border-border">
              <span className="text-xs text-muted-foreground">Strona {meta?.page ?? 1} z {meta?.lastPage ?? 1}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border border-border rounded text-xs hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Poprzednia
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === meta?.lastPage}
                  className="px-3 py-1.5 border border-border rounded text-xs hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Następna
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <p>Brak zleceń spełniających kryteria.</p>
            <p className="text-sm mt-1">
              {searchTerm || statusFilter !== 'all'
                ? 'Spróbuj zmienić kryteria wyszukiwania' 
                : 'Utwórz pierwsze zlecenie, klikając przycisk "Nowe zlecenie"'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}