/**
 * Testy regresyjne: walidacja payloadu zlecenia i dat.
 * Uruchom: npm run test -w apps/web
 */
import { describe, it, expect } from 'vitest'
import { CreateOrderSchema } from '@lama-stage/shared-types'

describe('Order form payload', () => {
  it('CreateOrderSchema akceptuje minimalny poprawny payload', () => {
    const payload = {
      name: 'Test event',
      status: 'DRAFT',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-01'),
      clientId: '00000000-0000-0000-0000-000000000001',
      discountGlobal: 0,
      vatRate: 23,
      isRecurring: false,
      stages: [],
      equipmentItems: [],
      productionItems: [],
    }
    const result = CreateOrderSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('CreateOrderSchema odrzuca brak nazwy', () => {
    const payload = {
      name: '',
      status: 'DRAFT',
      startDate: new Date(),
      endDate: new Date(),
      clientId: '00000000-0000-0000-0000-000000000001',
      discountGlobal: 0,
      vatRate: 23,
      isRecurring: false,
      stages: [],
      equipmentItems: [],
      productionItems: [],
    }
    const result = CreateOrderSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('CreateOrderSchema akceptuje zlecenie z jedną pozycją sprzętu i day1=1', () => {
    const payload = {
      name: 'Event ze sprzętem',
      status: 'DRAFT',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-02'),
      clientId: '00000000-0000-0000-0000-000000000001',
      discountGlobal: 0,
      vatRate: 23,
      isRecurring: false,
      stages: [],
      equipmentItems: [
        {
          name: 'Mikrofon',
          category: 'Audio',
          quantity: 2,
          unitPrice: 100,
          days: 2,
          discount: 0,
          pricingRule: { day1: 1.0, nextDays: 0.5 },
          visibleInOffer: true,
          sortOrder: 0,
        },
      ],
      productionItems: [],
    }
    const result = CreateOrderSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })
})
