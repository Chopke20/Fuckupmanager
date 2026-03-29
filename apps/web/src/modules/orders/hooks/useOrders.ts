import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderApi } from '../api/order.api';
import { Order, CreateOrderDto, UpdateOrderDto } from '@lama-stage/shared-types';

export const orderKeys = {
  all: ['orders'] as const,
  list: (params?: any) => [...orderKeys.all, 'list', params] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
  conflicts: (params?: any) => [...orderKeys.all, 'conflicts', params] as const,
};

export const useOrders = (params?: {
  status?: string;
  clientId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
  deletedOnly?: boolean;
  includeDeleted?: boolean;
}) => {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => orderApi.getAll(params),
  });
};

export const useOrder = (id: string) => {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => orderApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: orderApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
};

export const useUpdateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrderDto }) =>
      orderApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(variables.id) });
    },
  });
};

export const useDeleteOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: orderApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
};

export const useRestoreOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: orderApi.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
};

export const useDeleteOrderPermanent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: orderApi.deletePermanent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
};

export const useOrderConflicts = (params?: { from?: string; to?: string }) => {
  return useQuery({
    queryKey: orderKeys.conflicts(params),
    queryFn: () => orderApi.getConflicts(params),
  });
};