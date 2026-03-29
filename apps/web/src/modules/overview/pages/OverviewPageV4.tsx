import { useState } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Calendar, ChevronRight, Plus, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useOverviewStats, useUpcomingOrders, useLogisticConflicts } from '../hooks/useOverview'
import CalendarWidget from '../components/CalendarWidget'
import { calculateOrderNetValue } from '@lama-stage/shared-types';

export default function OverviewPageV4() {
  const { data: stats, isLoading: statsLoading } = useOverviewStats()
  const { data: upcomingOrders, isLoading: upcomingLoading } = useUpcomingOrders(5)
  const { data: conflicts, isLoading: conflictsLoading } = useLogisticConflicts()
  const [showAddBlock, setShowAddBlock] = useState(false)

  // Najbliższe zlecenie (tylko jedno, najważniejsze)
  const nextOrder = upcomingOrders && upcomingOrders.length > 0 ? upcomingOrders[0] : null

  // Statystyki inline
  const statItems = [
    { label: 'Zlecenia', value: stats?.totalOrders ?? 0 },
    { label: 'Potwierdzone', value: stats?.confirmedOrders ?? 0 },
    { label: 'Oferta wysłana', value: stats?.offerSentOrders ?? 0 },
    { label: 'Wartość', value: `${(stats?.totalValue ?? 0).toLocaleString('pl')} PLN` },
  ]

  return (
    <div className="space-y-6">
      {/* Nagłówek bez podtytułu */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Przegląd</h1>
        <button
          type="button"
          onClick={() => setShowAddBlock(!showAddBlock)}
          className="px-4 py-2 border-2 border-primary text-primary bg-transparent text-sm rounded hover:bg-primary/10 transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Dodaj blokadę sprzętu
        </button>
      </div>

      {/* Wiersz statystyk inline */}
      <div className="flex items-center gap-6 text-sm">
        {statItems.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-muted-foreground">{item.label}:</span>
            <span className="font-semibold">{item.value}</span>
            {index < statItems.length - 1 && (
              <span className="text-muted-foreground">·</span>
            )}
          </div>
        ))}
      </div>

      {/* Najbliższe zlecenie (tylko jedno) */}
      {nextOrder && (
        <Link
          to={`/orders/${nextOrder.id}`}
          className="border border-border rounded p-4 hover:border-primary/30 transition-colors block bg-surface-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-medium">{nextOrder.name}</h3>
                <span className={`px-2 py-1 text-xs rounded ${nextOrder.status === 'CONFIRMED' ? 'bg-green-500/20 text-green-500' : 'bg-[#282f46] text-[#5d80dd]'}`}>
                  {nextOrder.status === 'CONFIRMED' ? 'Potwierdzone' : 'Oferta wysłana'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {nextOrder.client?.companyName || 'Brak klienta'} •
                {format(new Date(nextOrder.dateFrom), ' dd.MM')} - {format(new Date(nextOrder.dateTo), 'dd.MM')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-semibold">
                ~{calculateOrderNetValue(nextOrder).toLocaleString('pl')} PLN netto
              </span>
              <span className="text-primary flex items-center gap-1 text-sm">
                Edytuj <ChevronRight size={16} />
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* Pełnoszerokościowy kalendarz */}
      <div className="border border-border rounded overflow-hidden">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="text-primary" size={20} />
            <h2 className="text-lg font-semibold">Kalendarz zleceń</h2>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500/30 rounded"></div>
              <span className="text-muted-foreground">Montaż</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500/30 rounded"></div>
              <span className="text-muted-foreground">Wydarzenie</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500/30 rounded"></div>
              <span className="text-muted-foreground">Demontaż</span>
            </div>
          </div>
        </div>
        <div className="p-6">
          <CalendarWidget />
        </div>
      </div>

      {/* Konflikty logistyczne (kompaktowe) */}
      {conflicts && conflicts.length > 0 && (
        <div className="border border-border rounded p-4">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="text-red-500" size={20} />
            <h3 className="font-semibold">Konflikty logistyczne</h3>
            <span className="px-2 py-1 bg-red-500/20 text-red-500 text-xs rounded">
              {conflicts.length}
            </span>
          </div>
          <div className="space-y-2">
            {conflicts.slice(0, 3).map(conflict => (
              <div key={conflict.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${conflict.severity === 'high' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span>{conflict.description}</span>
                </div>
                <span className="text-muted-foreground">
                  {conflict.equipmentName} • {conflict.date}
                </span>
              </div>
            ))}
            {conflicts.length > 3 && (
              <div className="text-center pt-2 text-sm text-muted-foreground">
                + {conflicts.length - 3} więcej konfliktów
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal dodawania blokady sprzętu (ukryty domyślnie) */}
      {showAddBlock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Dodaj blokadę sprzętu</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Sprzęt</label>
                <select className="w-full bg-background border border-border rounded px-3 py-2">
                  <option>Wybierz sprzęt...</option>
                  <option>Głośnik L-Acoustics K2</option>
                  <option>Projektor Barco 4K</option>
                  <option>Światło moving head</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Data od</label>
                  <input type="date" className="w-full bg-background border border-border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Data do</label>
                  <input type="date" className="w-full bg-background border border-border rounded px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Ilość</label>
                <input type="number" min="1" defaultValue="1" className="w-full bg-background border border-border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Notatka (opcjonalnie)</label>
                <textarea className="w-full bg-background border border-border rounded px-3 py-2" rows={2} />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddBlock(false)}
                  className="px-4 py-2 border border-border rounded hover:bg-surface-2 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  className="px-4 py-2 border-2 border-primary text-primary bg-transparent rounded hover:bg-primary/10 transition-colors"
                >
                  Dodaj blokadę
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
