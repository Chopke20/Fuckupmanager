import { useEffect, useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { Order } from '@lama-stage/shared-types'

const DRAFT_KEY_PREFIX = 'order-draft-'

function getDraftKey(orderId: string | undefined): string {
  return `${DRAFT_KEY_PREFIX}${orderId || 'new'}`
}

export function useOrderFormDraft(
  orderId: string | undefined,
  methods: UseFormReturn<Partial<Order>>,
  isEditing: boolean,
  options?: { skipDateRestore?: boolean }
) {
  const { setValue } = methods
  const loadedRef = useRef(false)
  const skipDateRestore = options?.skipDateRestore ?? false

  useEffect(() => {
    if (isEditing) return
    if (loadedRef.current) return
    const key = getDraftKey(orderId)
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Order>
        if (parsed.name !== undefined) setValue('name', parsed.name)
        if (parsed.description !== undefined) setValue('description', parsed.description)
        if (parsed.status !== undefined) setValue('status', parsed.status)
        if (parsed.venue !== undefined) setValue('venue', parsed.venue)
        if (parsed.venuePlaceId !== undefined) setValue('venuePlaceId', parsed.venuePlaceId)
        if (!skipDateRestore) {
          if (parsed.dateFrom !== undefined) setValue('dateFrom', parsed.dateFrom)
          if (parsed.dateTo !== undefined) setValue('dateTo', parsed.dateTo)
        }
        if (parsed.clientId !== undefined) setValue('clientId', parsed.clientId)
        if (parsed.discountGlobal !== undefined) setValue('discountGlobal', parsed.discountGlobal)
        if (parsed.vatRate !== undefined) setValue('vatRate', parsed.vatRate)
        if (parsed.isRecurring !== undefined) setValue('isRecurring', parsed.isRecurring)
        if (Array.isArray(parsed.stages)) setValue('stages', parsed.stages)
        if (Array.isArray(parsed.equipmentItems)) setValue('equipmentItems', parsed.equipmentItems)
        if (Array.isArray(parsed.productionItems)) setValue('productionItems', parsed.productionItems)
      }
      loadedRef.current = true
    } catch {
      loadedRef.current = true
    }
  }, [orderId, isEditing, setValue, skipDateRestore])
}

export function clearOrderDraft(orderId: string | undefined) {
  try {
    localStorage.removeItem(getDraftKey(orderId ?? 'new'))
  } catch {
    //
  }
}
