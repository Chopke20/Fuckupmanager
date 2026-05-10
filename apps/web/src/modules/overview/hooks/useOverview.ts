import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import { Order, calculateOrderNetValue } from '@lama-stage/shared-types';

/** Odpakowuje listę zleceń z odpowiedzi API (format { data } lub tablica). */
function unwrapOrdersResponse(body: unknown): Order[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object' && 'data' in body) {
    const data = (body as { data: unknown }).data;
    return Array.isArray(data) ? data : [];
  }
  return [];
}

async function fetchOverviewOrders(): Promise<Order[]> {
  const body = await api.get<{ data: Order[] } | Order[]>('/orders');
  return unwrapOrdersResponse(body);
}

const overviewOrdersQuery = {
  queryKey: ['overview', 'orders'] as const,
  queryFn: fetchOverviewOrders,
};

/** Początek zlecenia — w odpowiedzi bywa `dateFrom`, w modelu jest `startDate`. */
export function orderStartDate(order: Order): Date {
  const raw = (order as { dateFrom?: string }).dateFrom ?? order.startDate;
  return raw instanceof Date ? raw : new Date(raw);
}

/** Koniec zlecenia — analogicznie `dateTo` vs `endDate`. */
export function orderEndDate(order: Order): Date {
  const raw = (order as { dateTo?: string }).dateTo ?? order.endDate;
  return raw instanceof Date ? raw : new Date(raw);
}

export interface OverviewStats {
  totalOrders: number;
  confirmedOrders: number;
  offerSentOrders: number;
  draftOrders: number;
  totalValue: number;
  /** Wartość netto zleceń potwierdzonych (CONFIRMED). */
  confirmedValue: number;
  /** Przychód netto zleceń z datą w bieżącym roku (wg początku zlecenia). */
  revenueCurrentYear: number;
  upcomingOrdersCount: number;
}

export interface LogisticConflict {
  id: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  equipmentName: string;
  orderIds: string[];
  date: string;
}

/** Pozycje wymagające potwierdzenia (podwykonawca / wynajem) — UI jak konflikty, dane z API później. */
export interface SubcontractorRentalPendingItem {
  id: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  kind: 'subcontractor' | 'rental';
  orderId: string;
  orderName: string;
  /** Np. nazwa firmy albo pozycja sprzętowa. */
  label: string;
  date: string;
}

function buildOverviewStats(orders: Order[]): OverviewStats {
  const totalOrders = orders.length;
  const confirmedOrders = orders.filter((o) => o.status === 'CONFIRMED').length;
  const offerSentOrders = orders.filter((o) => o.status === 'OFFER_SENT').length;
  const draftOrders = orders.filter((o) => o.status === 'DRAFT').length;

  const totalValue = orders.reduce((sum, order) => sum + calculateOrderNetValue(order), 0);
  const confirmedValue = orders
    .filter((o) => o.status === 'CONFIRMED')
    .reduce((sum, order) => sum + calculateOrderNetValue(order), 0);

  const currentYear = new Date().getFullYear();
  const revenueCurrentYear = orders
    .filter((o) => {
      const d = orderStartDate(o);
      if (Number.isNaN(d.getTime())) return false;
      return d.getFullYear() === currentYear;
    })
    .reduce((sum, order) => sum + calculateOrderNetValue(order), 0);

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingOrdersCount = orders.filter((order) => {
    const dateFrom = orderStartDate(order);
    if (Number.isNaN(dateFrom.getTime())) return false;
    return dateFrom >= now && dateFrom <= weekFromNow;
  }).length;

  return {
    totalOrders,
    confirmedOrders,
    offerSentOrders,
    draftOrders,
    totalValue,
    confirmedValue,
    revenueCurrentYear,
    upcomingOrdersCount,
  };
}

function selectUpcomingOrders(orders: Order[], limit: number): Order[] {
  const now = new Date();
  const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return orders
    .filter((order) => {
      const isActive = order.status === 'CONFIRMED' || order.status === 'OFFER_SENT';
      if (!isActive) return false;
      const dateFrom = orderStartDate(order);
      if (Number.isNaN(dateFrom.getTime())) return false;
      return dateFrom >= now && dateFrom <= monthFromNow;
    })
    .sort((a, b) => orderStartDate(a).getTime() - orderStartDate(b).getTime())
    .slice(0, limit);
}

/** Surowa lista zleceń dla dashboardu (współdzielone zapytanie z hookami poniżej). */
export function useOverviewOrders() {
  return useQuery({
    ...overviewOrdersQuery,
  });
}

export function useOverviewStats() {
  return useQuery({
    ...overviewOrdersQuery,
    select: buildOverviewStats,
  });
}

export function useLogisticConflicts() {
  return useQuery({
    queryKey: ['overview', 'conflicts'],
    staleTime: Infinity,
    queryFn: async (): Promise<LogisticConflict[]> => {
      // TODO: podpiąć endpoint; poniżej dane orientacyjne do UI.
      return [
        {
          id: '1',
          description: 'Ten sam sprzęt (Mixer X32) w dwóch zleceniach 25.02',
          severity: 'high' as const,
          equipmentName: 'Mixer X32',
          orderIds: ['order-1', 'order-2'],
          date: '2026-02-25',
        },
        {
          id: '2',
          description: 'Przekroczona dostępność głośników L-Acoustics',
          severity: 'medium' as const,
          equipmentName: 'L-Acoustics K2',
          orderIds: ['order-3', 'order-4', 'order-5'],
          date: '2026-02-28',
        },
      ];
    },
  });
}

export function usePendingSubcontractorRentals() {
  return useQuery({
    queryKey: ['overview', 'pending-subcontractor-rentals'],
    staleTime: Infinity,
    queryFn: async (): Promise<SubcontractorRentalPendingItem[]> => {
      // TODO: endpoint agregujący potwierdzenia podwykonawców i wynajmów przypiętych do zleceń.
      return [
        {
          id: 'pdr-1',
          description: 'Transport sceniczny — brak potwierdzenia dostępności i stawki',
          severity: 'high' as const,
          kind: 'subcontractor' as const,
          orderId: '00000000-0000-4000-a000-000000000011',
          orderName: 'Koncert — Arena 2026',
          label: 'TransLog Sp. z o.o.',
          date: '2026-02-20',
        },
        {
          id: 'pdr-2',
          description: 'Wynajem moving headów — zamówienie wysłane, brak akceptacji od dostawcy',
          severity: 'medium' as const,
          kind: 'rental' as const,
          orderId: '00000000-0000-4000-a000-000000000022',
          orderName: 'Event korporacyjny — MTP',
          label: '6× LED Beam 280',
          date: '2026-02-26',
        },
      ];
    },
  });
}

export function useUpcomingOrders(limit = 5) {
  return useQuery({
    ...overviewOrdersQuery,
    select: (orders) => selectUpcomingOrders(orders, limit),
  });
}

export function useInProgressOrders() {
  return useQuery({
    ...overviewOrdersQuery,
    select: (orders) => orders.filter((order) => order.status === 'OFFER_SENT'),
  });
}
