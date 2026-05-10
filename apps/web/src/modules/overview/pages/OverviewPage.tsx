import { Calendar, AlertTriangle, TrendingUp, FileText, DollarSign, ChevronDown, Handshake } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  useOverviewStats,
  useLogisticConflicts,
  usePendingSubcontractorRentals,
  useUpcomingOrders,
  orderStartDate,
} from '../hooks/useOverview';
import CalendarWidget from '../components/CalendarWidget';
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

const overviewPanel =
  'group bg-surface rounded-xl border border-border overflow-hidden transition-colors hover:border-border focus-within:border-primary/25';
const overviewSummary =
  'flex w-full cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left select-none [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export default function OverviewPage() {
  const { data: stats, isPending: statsPending } = useOverviewStats();
  const { data: conflicts, isPending: conflictsPending } = useLogisticConflicts();
  const { data: pendingSubRentals, isPending: pendingSubRentalsPending } = usePendingSubcontractorRentals();
  const { data: upcomingOrders, isPending: upcomingPending } = useUpcomingOrders(5);

  const getStatValue = (key: StatKey): string | number => {
    if (statsPending) return '—';
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

  const conflictCount = conflicts?.length ?? 0;
  const pendingSubRentalCount = pendingSubRentals?.length ?? 0;
  const upcomingCount = upcomingOrders?.length ?? 0;

  const kindLabels = { subcontractor: 'Podwykonawca', rental: 'Wynajem' } as const;

  return (
    <div className="space-y-6">
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
          const className =
            'bg-surface rounded-md border border-border px-3 py-1.5 flex items-center gap-2 min-h-[2.75rem] transition-colors hover:border-primary/30';
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <details className={overviewPanel}>
          <summary className={overviewSummary}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <AlertTriangle className="shrink-0 text-red-500" size={20} />
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-tight">Konflikty logistyczne</h2>
                <p className="text-xs text-muted-foreground truncate">Kolizje sprzętu i terminów (zwiń, żeby dać więcej miejsca kalendarzowi)</p>
              </div>
              {conflictsPending ? (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">…</span>
              ) : conflictCount > 0 ? (
                <span className="ml-auto shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400 tabular-nums">
                  {conflictCount}
                </span>
              ) : (
                <span className="ml-auto shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">0</span>
              )}
            </div>
            <ChevronDown className="shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" size={20} />
          </summary>
          <div className="border-t border-border bg-surface-2/40 px-4 py-3">
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {conflictsPending ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Ładowanie konfliktów...</div>
              ) : conflicts && conflicts.length > 0 ? (
                conflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      conflict.severity === 'high'
                        ? 'border-red-500/30 bg-red-500/[0.07]'
                        : conflict.severity === 'medium'
                          ? 'border-amber-500/30 bg-amber-500/[0.07]'
                          : 'border-blue-500/30 bg-blue-500/[0.07]'
                    }`}
                  >
                    <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${severityColors[conflict.severity]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{conflict.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded-full px-1.5 py-0.5 font-medium text-white ${severityColors[conflict.severity]}`}>
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
                <div className="py-8 text-center text-sm text-muted-foreground">Brak wykrytych konfliktów.</div>
              )}
            </div>
          </div>
        </details>

        <details className={overviewPanel}>
          <summary className={overviewSummary}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Handshake className="shrink-0 text-amber-400" size={20} />
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-tight">Podwykonawcy i wynajmy</h2>
                <p className="text-xs text-muted-foreground truncate">Do potwierdzenia — szczegóły wkrótce</p>
              </div>
              {pendingSubRentalsPending ? (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">…</span>
              ) : pendingSubRentalCount > 0 ? (
                <span className="ml-auto shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-200 tabular-nums">
                  {pendingSubRentalCount}
                </span>
              ) : (
                <span className="ml-auto shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">0</span>
              )}
            </div>
            <ChevronDown className="shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" size={20} />
          </summary>
          <div className="border-t border-border bg-surface-2/40 px-4 py-3">
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {pendingSubRentalsPending ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Ładowanie…</div>
              ) : pendingSubRentals && pendingSubRentals.length > 0 ? (
                pendingSubRentals.map((item) => (
                  <Link
                    key={item.id}
                    to={`/orders/${item.orderId}`}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/35 ${
                      item.severity === 'high'
                        ? 'border-red-500/30 bg-red-500/[0.07]'
                        : item.severity === 'medium'
                          ? 'border-amber-500/30 bg-amber-500/[0.07]'
                          : 'border-blue-500/30 bg-blue-500/[0.07]'
                    }`}
                  >
                    <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${severityColors[item.severity]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{item.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`rounded-full px-1.5 py-0.5 font-medium text-white ${severityColors[item.severity]}`}
                        >
                          {severityLabels[item.severity]}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 font-medium ${
                            item.kind === 'rental'
                              ? 'bg-violet-500/25 text-violet-200'
                              : 'bg-amber-500/25 text-amber-100'
                          }`}
                        >
                          {kindLabels[item.kind]}
                        </span>
                        <span className="text-muted-foreground">
                          {item.orderName} • {item.label} • {item.date}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">Brak pozycji do potwierdzenia.</div>
              )}
            </div>
          </div>
        </details>

        <details className={overviewPanel}>
          <summary className={overviewSummary}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Calendar className="shrink-0 text-green-500" size={20} />
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-tight">Najbliższe zlecenia</h2>
                <p className="text-xs text-muted-foreground truncate">Potwierdzone i oferta wysłana — kolejne 30 dni</p>
              </div>
              {upcomingPending ? (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">…</span>
              ) : upcomingCount > 0 ? (
                <span className="ml-auto shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
                  {upcomingCount}
                </span>
              ) : (
                <span className="ml-auto shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">0</span>
              )}
            </div>
            <ChevronDown className="shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" size={20} />
          </summary>
          <div className="border-t border-border bg-surface-2/40 px-4 py-3">
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {upcomingPending ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Ładowanie zleceń...</div>
              ) : upcomingOrders && upcomingOrders.length > 0 ? (
                upcomingOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="block rounded-lg border border-border bg-surface p-3 transition-colors hover:border-primary/35"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium leading-snug break-words">{order.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{order.client?.companyName || 'Brak klienta'}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary whitespace-nowrap">
                        {format(orderStartDate(order), 'dd.MM')}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span
                        className={`rounded-full px-1.5 py-0.5 ${
                          order.status === 'CONFIRMED'
                            ? 'bg-green-500/20 text-green-500'
                            : order.status === 'OFFER_SENT'
                              ? 'bg-[#282f46] text-[#5d80dd]'
                              : 'bg-gray-500/20 text-gray-500'
                        }`}
                      >
                        {order.status === 'CONFIRMED' ? 'Potwierdzone' : order.status === 'OFFER_SENT' ? 'Oferta wysłana' : 'Szkic'}
                      </span>
                      <span className="text-muted-foreground">~{calculateOrderNetValue(order).toLocaleString('pl')} PLN netto</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">Brak zleceń w tym oknie.</div>
              )}
            </div>
          </div>
        </details>
      </div>

      <CalendarWidget calendarHeightClass="min-h-[640px] h-[min(720px,calc(100vh-360px))]" dayMaxEvents={6} />
    </div>
  );
}
