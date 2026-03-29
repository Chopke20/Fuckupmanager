import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { equipmentApi } from '../api/equipment.api'
import { CreateEquipmentDto, UpdateEquipmentDto } from '@lama-stage/shared-types'

export const useEquipment = (params?: { category?: string, subcategory?: string, search?: string, page?: number, limit?: number, deletedOnly?: boolean }) => {
  return useQuery({
    queryKey: ['equipment', params],
    queryFn: () => equipmentApi.getAll(params),
  })
}

export const useEquipmentCategories = () => {
  return useQuery({
    queryKey: ['equipmentCategories'],
    queryFn: () => equipmentApi.getCategories(),
  })
}

export const useResourceSubcategories = () => {
  return useQuery({
    queryKey: ['resourceSubcategories'],
    queryFn: () => equipmentApi.getResourceSubcategories(),
  })
}

export const useEquipmentById = (id: string) => {
  return useQuery({
    queryKey: ['equipment', id],
    queryFn: () => equipmentApi.getById(id),
    enabled: !!id,
  })
}

export const useCreateEquipment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: equipmentApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
    },
  })
}

export const useUpdateEquipment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEquipmentDto }) =>
      equipmentApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      queryClient.invalidateQueries({ queryKey: ['equipment', variables.id] })
    },
  })
}

export const useDeleteEquipment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: equipmentApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
    },
  })
}

export const useRestoreEquipment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: equipmentApi.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
    },
  })
}

export const useDeleteEquipmentPermanent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: equipmentApi.deletePermanent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
    },
  })
}

export const useEquipmentAvailability = (equipmentId: string, date: Date) => {
  return useQuery({
    queryKey: ['equipmentAvailability', equipmentId, date.toISOString().split('T')[0]],
    queryFn: () => equipmentApi.getAvailability(equipmentId, date),
    enabled: !!equipmentId && !!date,
  })
}
