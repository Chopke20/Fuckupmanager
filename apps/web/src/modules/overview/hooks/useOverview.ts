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

export interface OverviewStats {
  totalOrders: number;
  confirmedOrders: number;
  offerSentOrders: number;
  draftOrders: number;
  totalValue: number;
  /** Wartość netto zleceń potwierdzonych (CONFIRMED). */
  confirmedValue: number;
  /** Przychód netto zleceń z datą w bieżącym roku (wg dateFrom). */
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

export function useOverviewStats() {
  return useQuery<OverviewStats>({
    queryKey: ['overview', 'stats'],
    queryFn: async () => {
      const body = await api.get<{ data: Order[] } | Order[]>('/orders');
      const orders = unwrapOrdersResponse(body);
      
      const totalOrders = orders.length;
      const confirmedOrders = orders.filter((o: Order) => o.status === 'CONFIRMED').length;
      const offerSentOrders = orders.filter((o: Order) => o.status === 'OFFER_SENT').length;
      const draftOrders = orders.filter((o: Order) => o.status === 'DRAFT').length;

      const totalValue = orders.reduce((sum: number, order: Order) => sum + calculateOrderNetValue(order), 0);
      const confirmedValue = orders
        .filter((o: Order) => o.status === 'CONFIRMED')
        .reduce((sum: number, order: Order) => sum + calculateOrderNetValue(order), 0);
      const currentYear = new Date().getFullYear();
      const revenueCurrentYear = orders
        .filter((o: Order) => {
          const dateFrom = (o as any).dateFrom || (o as any).startDate;
          if (!dateFrom) return false;
          return new Date(dateFrom).getFullYear() === currentYear;
        })
        .reduce((sum: number, order: Order) => sum + calculateOrderNetValue(order), 0);
      
      const upcomingOrdersCount = orders.filter((order: Order) => {
        const dateFrom = new Date(order.dateFrom);
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
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
    },
  });
}

export function useLogisticConflicts() {
  return useQuery<LogisticConflict[]>({
    queryKey: ['overview', 'conflicts'],
    queryFn: async () => {
      // TODO: Implementacja rzeczywistego endpointu
      // Na razie mock
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

export function useUpcomingOrders(limit = 5) {
  return useQuery<Order[]>({
    queryKey: ['overview', 'upcoming', limit],
    queryFn: async () => {
      const body = await api.get<{ data: Order[] } | Order[]>('/orders');
      const orders = unwrapOrdersResponse(body);

      return orders
        .filter((order: Order) => {
          // Tylko aktywne statusy: potwierdzone lub oferta wysłana
          const isActive = order.status === 'CONFIRMED' || order.status === 'OFFER_SENT';
          if (!isActive) return false;

          const dateFrom = new Date(order.dateFrom);
          const now = new Date();
          const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          return dateFrom >= now && dateFrom <= monthFromNow;
        })
        .sort((a: Order, b: Order) => new Date((a as any).dateFrom ?? (a as any).startDate).getTime() - new Date((b as any).dateFrom ?? (b as any).startDate).getTime())
        .slice(0, limit);
    },
  });
}

export function useInProgressOrders() {
  return useQuery<Order[]>({
    queryKey: ['overview', 'in-progress'],
    queryFn: async () => {
      const body = await api.get<{ data: Order[] } | Order[]>('/orders');
      const orders = unwrapOrdersResponse(body);
      return orders.filter((order: Order) => order.status === 'OFFER_SENT');
    },
  });
}