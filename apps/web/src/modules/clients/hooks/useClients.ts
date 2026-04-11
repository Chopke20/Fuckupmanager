import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientApi } from '../api/client.api'
import { CreateClientDto, UpdateClientDto } from '@lama-stage/shared-types'

export const useClients = (params?: { page?: number, limit?: number, search?: string, deletedOnly?: boolean }) => {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: () => clientApi.getAll(params),
  })
}

export const useClient = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => clientApi.getById(id),
    enabled: !!id && (options?.enabled ?? true),
  })
}

export const useCreateClient = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: clientApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export const useUpdateClient = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClientDto }) =>
      clientApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['clients', variables.id] })
    },
  })
}

export const useDeleteClient = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: clientApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export const useRestoreClient = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: clientApi.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export const useDeleteClientPermanent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: clientApi.deletePermanent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}