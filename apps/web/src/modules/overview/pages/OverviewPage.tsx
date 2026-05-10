import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  AlertTriangle,
  TrendingUp,
  FileText,
  DollarSign,
  ChevronDown,
  Handshake,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  useOverviewStats,
  useLogisticConflicts,
  usePendingSubcontractorRentals,
  useUpcomingOrders,
  orderStartDate,
} from '../hooks/useOverview';
import { useOverviewAcknowledgements } from '../hooks/useOverviewAcknowledgements';
import CalendarWidget from '../components/CalendarWidget';
import { calculateOrderNetValue } from '@lama-stage/shared-types';

type StatKey = 'total' | 'confirmed' | 'offerSent' | 'value' | 'revenue';
type OverlayPanelId = 'conflicts' | 'subs' | 'upcoming';

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

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const triggerBtn =
  'group flex min-h-[3.25rem] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export default function OverviewPage() {
  const [openOverlay, setOpenOverlay] = useState<OverlayPanelId | null>(null);
  const { data: stats, isPending: statsPending } = useOverviewStats();
  const { data: conflicts, isPending: conflictsPending } = useLogisticConflicts();
  const { data: pendingSubRentals, isPending: pendingSubRentalsPending } = usePendingSubcontractorRentals();
  const { data: upcomingOrders, isPending: upcomingPending } = useUpcomingOrders(5);
  const {
    acknowledgeConflict,
    acknowledgeSubcontractorRental,
    isConflictAcknowledged,
    isSubcontractorRentalAcknowledged,
  } = useOverviewAcknowledgements();

  useEffect(() => {
    if (!openOverlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenOverlay(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openOverlay]);

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

  const kindLabels = { subcontractor: 'Podwykonawca', rental: 'Wynajem' } as const;

  const conflictList = conflicts ?? [];
  const subList = pendingSubRentals ?? [];

  const conflictUnacked = useMemo(
    () => conflictList.filter((c) => !isConflictAcknowledged(c.id)).length,
    [conflictList, isConflictAcknowledged]
  );
  const subUnacked = useMemo(
    () => subList.filter((s) => !isSubcontractorRentalAcknowledged(s.id)).length,
    [subList, isSubcontractorRentalAcknowledged]
  );

  const conflictsFullyAcknowledged =
    !conflictsPending && conflictList.length > 0 && conflictUnacked === 0;
  const subsFullyAcknowledged =
    !pendingSubRentalsPending && subList.length > 0 && subUnacked === 0;

  const upcomingCount = upcomingOrders?.length ?? 0;

  const toggleOverlay = (id: OverlayPanelId) => {
    setOpenOverlay((cur) => (cur === id ? null : id));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {statRows.map((row) => {
          const Icon = row.icon;
          const content = (
            <>
              <Icon className={`${row.color} shrink-0`} size={14} />
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                <span className="truncate text-sm font-semibold tabular-nums leading-tight text-foreground">
                  {getStatValue(row.key)}
                </span>
                <span className="truncate text-[10px] uppercase leading-tight tracking-wide text-muted-foreground">
                  {row.label}
                </span>
              </div>
            </>
          );
          const className =
            'flex min-h-[2.75rem] items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 transition-colors hover:border-primary/30';
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <button
          type="button"
          className={cn(triggerBtn, openOverlay === 'conflicts' && 'border-primary/40 ring-2 ring-primary/25')}
          onClick={() => toggleOverlay('conflicts')}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <AlertTriangle
              className={cn('shrink-0', conflictUnacked > 0 ? 'text-red-500' : 'text-muted-foreground')}
              size={20}
              aria-hidden
            />
            <div className="min-w-0">
              <div className="text-base font-semibold leading-tight">Konflikty logistyczne</div>
              <p className="truncate text-xs text-muted-foreground">Lista nad kalendarzem — akceptacja = świadomość</p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            {conflictsPending ? (
              <span className="text-xs text-muted-foreground">…</span>
            ) : conflictsFullyAcknowledged ? (
              <span
                className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-green-500/15 px-2"
                title="Wszystkie konflikty przejęte do wiadomości"
              >
                <CheckCircle2 className="text-green-500" size={16} aria-hidden />
              </span>
            ) : (
              <span
                className={cn(
                  'inline-flex min-h-[22px] min-w-[26px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                  conflictUnacked > 0
                    ? 'bg-red-500/25 text-red-200 overview-attention-pulse-count'
                    : 'bg-surface-2 text-muted-foreground'
                )}
              >
                {conflictUnacked}
              </span>
            )}
            <ChevronDown
              className={cn('text-muted-foreground transition-transform duration-200', openOverlay === 'conflicts' && 'rotate-180')}
              size={18}
            />
          </span>
        </button>

        <button
          type="button"
          className={cn(triggerBtn, openOverlay === 'subs' && 'border-primary/40 ring-2 ring-primary/25')}
          onClick={() => toggleOverlay('subs')}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Handshake
              className={cn('shrink-0', subUnacked > 0 ? 'text-amber-400' : 'text-muted-foreground')}
              size={20}
              aria-hidden
            />
            <div className="min-w-0">
              <div className="text-base font-semibold leading-tight">Podwykonawcy i wynajmy</div>
              <p className="truncate text-xs text-muted-foreground">Do przejęcia informacyjnie</p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            {pendingSubRentalsPending ? (
              <span className="text-xs text-muted-foreground">…</span>
            ) : subsFullyAcknowledged ? (
              <span
                className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-green-500/15 px-2"
                title="Wszystkie pozycje przejęte do wiadomości"
              >
                <CheckCircle2 className="text-green-500" size={16} aria-hidden />
              </span>
            ) : (
              <span
                className={cn(
                  'inline-flex min-h-[22px] min-w-[26px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                  subUnacked > 0 ? 'bg-amber-500/25 text-amber-100 overview-attention-pulse-count' : 'bg-surface-2 text-muted-foreground'
                )}
              >
                {subUnacked}
              </span>
            )}
            <ChevronDown className={cn('text-muted-foreground transition-transform duration-200', openOverlay === 'subs' && 'rotate-180')} size={18} />
          </span>
        </button>

        <button
          type="button"
          className={cn(
            triggerBtn,
            openOverlay === 'upcoming' && 'border-primary/40 ring-2 ring-primary/25',
            'md:col-span-2 xl:col-span-1'
          )}
          onClick={() => toggleOverlay('upcoming')}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Calendar className="shrink-0 text-green-500" size={20} />
            <div className="min-w-0">
              <div className="text-base font-semibold leading-tight">Najbliższe zlecenia</div>
              <p className="truncate text-xs text-muted-foreground">Kolejne 30 dni</p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            {upcomingPending ? (
              <span className="text-xs text-muted-foreground">…</span>
            ) : (
              <span className="inline-flex min-h-[22px] min-w-[26px] items-center justify-center rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
                {upcomingCount}
              </span>
            )}
            <ChevronDown
              className={cn('text-muted-foreground transition-transform duration-200', openOverlay === 'upcoming' && 'rotate-180')}
              size={18}
            />
          </span>
        </button>
      </div>

      <div className="relative">
        <CalendarWidget calendarHeightClass="min-h-[640px] h-[min(720px,calc(100vh-360px))]" dayMaxEvents={8} />

        {openOverlay && (
          <>
            <button
              type="button"
              className="absolute inset-0 z-[25] cursor-default rounded-xl bg-black/50 backdrop-blur-[1px]"
              aria-label="Zamknij panel"
              onClick={() => setOpenOverlay(null)}
            />
            <div className="absolute left-3 right-3 top-4 z-[30] flex max-h-[min(54vh,520px)] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl md:left-8 md:right-8">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                <div className="min-w-0 font-semibold">
                  {openOverlay === 'conflicts' && 'Konflikty logistyczne'}
                  {openOverlay === 'subs' && 'Podwykonawcy i wynajmy'}
                  {openOverlay === 'upcoming' && 'Najbliższe zlecenia'}
                </div>
                <button
                  type="button"
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                  aria-label="Zamknij"
                  onClick={() => setOpenOverlay(null)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {openOverlay === 'conflicts' &&
                  (conflictsPending ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Ładowanie konfliktów…</div>
                  ) : conflictList.length > 0 ? (
                    <div className="space-y-3">
                      {conflictList.map((conflict) => {
                        const acked = isConflictAcknowledged(conflict.id);
                        return (
                          <div
                            key={conflict.id}
                            className={cn(
                              'flex gap-3 rounded-lg border p-3',
                              acked
                                ? 'border-border/40 bg-surface-2/30 opacity-[0.92]'
                                : conflict.severity === 'high'
                                  ? 'border-red-500/35 bg-red-500/[0.07]'
                                  : conflict.severity === 'medium'
                                    ? 'border-amber-500/35 bg-amber-500/[0.07]'
                                    : 'border-blue-500/35 bg-blue-500/[0.07]'
                            )}
                          >
                            <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${severityColors[conflict.severity]}`} />
                            <div className="min-w-0 flex-1">
                              <p className={cn('text-sm font-medium leading-snug', acked && 'text-muted-foreground')}>
                                {conflict.description}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                <span className={cn(`rounded-full px-1.5 py-0.5 font-medium text-white`, severityColors[conflict.severity])}>
                                  {severityLabels[conflict.severity]}
                                </span>
                                <span className="text-muted-foreground">
                                  {conflict.equipmentName} • {conflict.date}
                                </span>
                                {acked && (
                                  <span className="inline-flex items-center gap-0.5 text-green-400">
                                    <CheckCircle2 size={14} aria-hidden /> Przejęte do wiadomości
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end justify-center">
                              {acked ? (
                                <CheckCircle2 className="text-green-500" size={24} aria-label="Zaakceptowano" />
                              ) : (
                                <button
                                  type="button"
                                  className="rounded-lg border border-primary/50 bg-transparent px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                                  onClick={() => acknowledgeConflict(conflict.id)}
                                >
                                  Akceptuj
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">Brak wykrytych konfliktów.</div>
                  ))}

                {openOverlay === 'subs' &&
                  (pendingSubRentalsPending ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Ładowanie…</div>
                  ) : subList.length > 0 ? (
                    <div className="space-y-3">
                      {subList.map((item) => {
                        const acked = isSubcontractorRentalAcknowledged(item.id);
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              'flex gap-3 rounded-lg border p-3',
                              acked
                                ? 'border-border/40 bg-surface-2/30 opacity-[0.92]'
                                : item.severity === 'high'
                                  ? 'border-red-500/35 bg-red-500/[0.07]'
                                  : item.severity === 'medium'
                                    ? 'border-amber-500/35 bg-amber-500/[0.07]'
                                    : 'border-blue-500/35 bg-blue-500/[0.07]'
                            )}
                          >
                            <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${severityColors[item.severity]}`} />
                            <div className="flex min-w-0 flex-1 gap-3">
                              <Link
                                to={`/orders/${item.orderId}`}
                                className={cn(
                                  'min-w-0 flex-1 hover:underline',
                                  acked ? 'text-muted-foreground' : 'text-foreground'
                                )}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <p className="text-sm font-medium leading-snug">{item.description}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                  <span className={`rounded-full px-1.5 py-0.5 font-medium text-white ${severityColors[item.severity]}`}>
                                    {severityLabels[item.severity]}
                                  </span>
                                  <span
                                    className={cn(
                                      'rounded-full px-1.5 py-0.5 font-medium',
                                      item.kind === 'rental' ? 'bg-violet-500/25 text-violet-200' : 'bg-amber-500/25 text-amber-100'
                                    )}
                                  >
                                    {kindLabels[item.kind]}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {item.orderName} • {item.label} • {item.date}
                                  </span>
                                  {acked && (
                                    <span className="inline-flex items-center gap-0.5 text-green-400">
                                      <CheckCircle2 size={14} aria-hidden /> Przejęte do wiadomości
                                    </span>
                                  )}
                                </div>
                              </Link>
                            </div>
                            <div className="flex shrink-0 flex-col items-end justify-center">
                              {acked ? (
                                <CheckCircle2 className="text-green-500" size={24} aria-label="Zaakceptowano" />
                              ) : (
                                <button
                                  type="button"
                                  className="rounded-lg border border-primary/50 bg-transparent px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                                  onClick={() => acknowledgeSubcontractorRental(item.id)}
                                >
                                  Akceptuj
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">Brak pozycji do potwierdzenia.</div>
                  ))}

                {openOverlay === 'upcoming' &&
                  (upcomingPending ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Ładowanie zleceń…</div>
                  ) : upcomingOrders && upcomingOrders.length > 0 ? (
                    <div className="space-y-2">
                      {upcomingOrders.map((order) => (
                        <Link
                          key={order.id}
                          to={`/orders/${order.id}`}
                          className="block rounded-lg border border-border bg-surface p-3 transition-colors hover:border-primary/35"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h3 className="break-words text-sm font-medium leading-snug">{order.name}</h3>
                              <p className="mt-1 text-xs text-muted-foreground">{order.client?.companyName || 'Brak klienta'}</p>
                            </div>
                            <span className="shrink-0 whitespace-nowrap rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
                              {format(orderStartDate(order), 'dd.MM')}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span
                              className={cn(
                                'rounded-full px-1.5 py-0.5',
                                order.status === 'CONFIRMED'
                                  ? 'bg-green-500/20 text-green-500'
                                  : order.status === 'OFFER_SENT'
                                    ? 'bg-[#282f46] text-[#5d80dd]'
                                    : 'bg-gray-500/20 text-gray-500'
                              )}
                            >
                              {order.status === 'CONFIRMED' ? 'Potwierdzone' : order.status === 'OFFER_SENT' ? 'Oferta wysłana' : 'Szkic'}
                            </span>
                            <span className="text-muted-foreground">~{calculateOrderNetValue(order).toLocaleString('pl')} PLN netto</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">Brak zleceń w tym oknie.</div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
