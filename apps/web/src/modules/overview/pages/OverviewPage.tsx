import { Calendar, AlertTriangle, TrendingUp, FileText, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOverviewStats, useLogisticConflicts, useUpcomingOrders } from '../hooks/useOverview';
import CalendarWidget from '../components/CalendarWidget';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { calculateOrderNetValue } from '@lama-stage/shared-types';

type StatKey = 'total' | 'confirmed' | 'offerSent' | 'value' | 'revenue';

const statRows: Array<{
  label: string;
  key: StatKey;
  icon: typeof FileText;
  color: string;
  to?: string;
}> = [
  { label: 'Wszystkie zlecenia', key: 'total', icon: FileText, color: 'text-blue-500', to: '/orders' },
  { label: 'Potwierdzone', key: 'confirmed', icon: TrendingUp, color: 'text-green-500', to: '/orders?status=CONFIRMED' },
  { label: 'Oferta wysłana', key: 'offerSent', icon: TrendingUp, color: 'text-orange-500', to: '/orders?status=OFFER_SENT' },
  { label: 'Wartość szac. (potw.)', key: 'value', icon: DollarSign, color: 'text-purple-500', to: '/finance' },
  { label: 'Przychód (aktualny rok)', key: 'revenue', icon: DollarSign, color: 'text-emerald-500', to: '/finance' },
];

export default function OverviewPage() {
  const { data: stats } = useOverviewStats();
  const { data: conflicts, isLoading: conflictsLoading } = useLogisticConflicts();
  const { data: upcomingOrders, isLoading: upcomingLoading } = useUpcomingOrders(5);
  // Usunięto: const { data: inProgressOrders } = useInProgressOrders();

  // Usunięto: const currentTime = format(new Date(), 'HH:mm');
  const currentDate = format(new Date(), 'EEEE, d MMMM yyyy', { locale: pl });

  const getStatValue = (key: StatKey): string | number => {
    if (key === 'total') return stats?.totalOrders ?? 0;
    if (key === 'confirmed') return stats?.confirmedOrders ?? 0;
    if (key === 'offerSent') return stats?.offerSentOrders ?? 0;
    if (key === 'value') return `${(stats?.confirmedValue ?? 0).toLocaleString('pl')} PLN`;
    if (key === 'revenue') return `${(stats?.revenueCurrentYear ?? 0).toLocaleString('pl')} PLN`;
    return '';
  };

  const severityColors = {
    high: 'bg-red-500',
    medium: 'bg-amber-500',
    low: 'bg-blue-500',
  };

  const severityLabels = {
    high: 'Wysoki',
    medium: 'Średni',
    low: 'Niski',
  };

  return (
    <div className="space-y-6 p-4"> {/* Dodano padding do głównego kontenera */}

      {/* Kompaktowe KPI — małe kafelki (klikalne prowadzą do listy zleceń z filtrem) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {statRows.map((row) => {
          const Icon = row.icon;
          const content = (
            <>
              <Icon className={`${row.color} shrink-0`} size={14} />
              <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
                <span className="text-sm font-semibold tabular-nums text-foreground leading-tight truncate">{getStatValue(row.key)}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide leading-tight truncate">{row.label}</span>
              </div>
            </>
          );
          const className = "bg-surface rounded-md border border-border px-3 py-1.5 flex items-center gap-2 min-h-[2.75rem] transition-colors hover:border-primary/30";
          if (row.to) {
            return (
              <Link key={row.key} to={row.to} className={className}>
                {content}
              </Link>
            );
          }
          return (
            <div key={row.key} className={className}>
              {content}
            </div>
          );
        })}
      </div>

      {/* Główny układ: Kalendarz (szeroko) + Boczne widgety (wąsko) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4"> {/* Zmieniono grid na większy, dla precyzyjniejszego podziału */}

        {/* Lewa kolumna: Kalendarz */}
        <div className="lg:col-span-8"> {/* Kalendarz zajmuje 8/12 kolumn */}
          <CalendarWidget />
        </div>

        {/* Prawa kolumna: Skonsolidowane widgety (Konflikty + Najbliższe zlecenia) */}
        <div className="lg:col-span-4 space-y-4"> {/* Zajmuje 4/12 kolumn, dodano space-y */}

          {/* Widget Konfliktów logistycznych (kompaktowy) */}
          <div className="bg-surface rounded-lg border border-border p-3"> {/* Zmniejszono padding */}
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="text-red-500" size={20} /> {/* Zmniejszono ikonę */}
              <h2 className="text-lg font-semibold">Konflikty</h2> {/* Skrócono tytuł */}
              {conflicts && conflicts.length > 0 && (
                <span className="px-2 py-0.5 bg-red-500/20 text-red-500 text-xs rounded-full">
                  {conflicts.length}
                </span>
              )}
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2"> {/* Dodano max-height i scroll */}
              {conflictsLoading ? (
                <div className="text-center py-4 text-muted-foreground">Ładowanie konfliktów...</div>
              ) : conflicts && conflicts.length > 0 ? (
                conflicts.map(conflict => (
                  <div
                    key={conflict.id}
                    className={`p-2.5 rounded border flex items-start gap-3 ${ // Zmniejszono padding
                      conflict.severity === 'high'
                        ? 'border-red-500/30 bg-red-500/5'
                        : conflict.severity === 'medium'
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-blue-500/30 bg-blue-500/5'
                    }`}
                  >
                    <div className={`mt-1 w-3 h-3 rounded-full ${severityColors[conflict.severity]}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-tight">{conflict.description}</p> {/* Lepsze prowadzenie linii */}
                      <div className="flex items-center gap-2 mt-1.5 text-xs"> {/* Zmniejszono odstęp */}
                        <span className={`px-1.5 py-0.5 rounded-full ${severityColors[conflict.severity]} text-white`}>
                          {severityLabels[conflict.severity]}
                        </span>
                        <span className="text-muted-foreground">
                          {conflict.equipmentName} • {conflict.date}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">Brak konfliktów.</div>
              )}
            </div>
          </div>

          {/* Widget Najbliższych zleceń (kompaktowy) */}
          <div className="bg-surface rounded-lg border border-border p-3"> {/* Zmniejszono padding */}
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="text-green-500" size={20} /> {/* Zmniejszono ikonę */}
              <h2 className="text-lg font-semibold">Najbliższe zlecenia</h2>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2"> {/* Dodano max-height i scroll */}
              {upcomingLoading ? (
                <div className="text-center py-4 text-muted-foreground">Ładowanie zleceń...</div>
              ) : upcomingOrders && upcomingOrders.length > 0 ? (
                upcomingOrders.map(order => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="p-3 bg-surface-2 rounded border border-border transition-colors hover:border-primary/30 block"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-sm">{order.name}</h3> {/* Zmniejszono font */}
                        <p className="text-xs text-muted-foreground"> {/* Zmniejszono font */}
                          {order.client?.companyName || 'Brak klienta'}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full whitespace-nowrap">
                        {format(new Date(order.dateFrom), 'dd.MM')}
                      </span>
                    </div>
                    <div className="mt-2 text-xs flex items-center justify-between">
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                        order.status === 'CONFIRMED'
                          ? 'bg-green-500/20 text-green-500'
                          : order.status === 'OFFER_SENT'
                          ? 'bg-[#282f46] text-[#5d80dd]'
                          : 'bg-gray-500/20 text-gray-500'
                      }`}>
                        {order.status === 'CONFIRMED' ? 'Potwierdzone' :
                         order.status === 'OFFER_SENT' ? 'Oferta wysłana' : 'Szkic'}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        ~{calculateOrderNetValue(order).toLocaleString('pl')} PLN netto
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">Brak zleceń.</div>
              )}
            </div>
          </div>
        </div>
      </div>
       {/* Usunięto sekcję "Zlecenia z ofertą wysłaną" */}
    </div>
  );
}