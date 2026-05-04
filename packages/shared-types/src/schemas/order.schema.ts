import { z } from 'zod';
import { ClientSchema } from './client.schema';
import { EquipmentSchema } from './equipment.schema';
import { PaginatedResponseSchema } from './common.schema';

export const ORDER_STATUSES = [
  'DRAFT',
  'OFFER_SENT',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
] as const;

export const OrderStatusSchema = z.enum(ORDER_STATUSES);

export const STAGE_TYPES = [
  'MONTAZ',
  'EVENT',
  'DEMONTAZ',
  'CUSTOM',
] as const;

export const StageTypeSchema = z.enum(STAGE_TYPES);

export const OrderStageSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  type: StageTypeSchema.default('CUSTOM'),
  label: z.string().optional(),
  date: z.string().datetime(),
  timeStart: z.string().optional(),
  timeEnd: z.string().optional(),
  notes: z.string().optional(),
  sortOrder: z.number().int().default(0),
  createdAt: z.string().datetime(),
});

export const CreateOrderStageSchema = OrderStageSchema.omit({
  id: true,
  orderId: true,
  createdAt: true,
}).extend({
  date: z.union([z.string().datetime(), z.coerce.date(), z.date()]),
});

export const UpdateOrderStageSchema = CreateOrderStageSchema.partial();

export const OrderEquipmentItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  equipmentId: z.string().uuid().optional(),
  equipment: EquipmentSchema.optional(),
  name: z.string().min(1, 'Nazwa jest wymagana'),
  description: z.string().optional(),
  category: z.string().default('Inne'),
  quantity: z.number().int().positive('Ilość musi być dodatnia'),
  unitPrice: z.number().nonnegative('Cena jednostkowa nie może być ujemna'),
  days: z.number().int().positive('Liczba dni musi być dodatnia').default(1),
  discount: z.number().min(0).max(100).default(0),
  pricingRule: z.object({
    day1: z.number().min(0).default(1.0),
    nextDays: z.number().min(0).default(0.5),
  }).optional(),
  visibleInOffer: z.boolean().default(true),
  isRental: z.boolean().default(false), // wynajem – bez marży (koszt = przychód)
  sortOrder: z.number().int().default(0),
  /** Opcjonalny koszt marży: ilość × koszt netto / jedn.; oba puste = cały netto pozycji jak dotąd */
  marginRentalUnits: z.number().nonnegative().nullable().optional(),
  marginRentalUnitCostNet: z.number().nonnegative().nullable().optional(),
  // Individual reservation dates for equipment availability checks
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateOrderEquipmentItemSchema = OrderEquipmentItemSchema.omit({
  id: true,
  orderId: true,
  equipment: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateOrderEquipmentItemSchema = CreateOrderEquipmentItemSchema.partial();

export const CURRENCIES = ['PLN', 'EUR'] as const;
export const CurrencySchema = z.enum(CURRENCIES);

export const PROJECT_CONTACT_KEYS = ['RAFAL', 'MICHAL'] as const;
export const ProjectContactKeySchema = z.enum(PROJECT_CONTACT_KEYS);

export const VAT_RATES_OFFER = [0, 23] as const;
export const VatRateOfferSchema = z.union([z.literal(0), z.literal(23)]);

export const PRODUCTION_RATE_TYPES = [
  'DAILY',
  'HOURLY',
  'FLAT',
] as const;

export const ProductionRateTypeSchema = z.enum(PRODUCTION_RATE_TYPES);

export const OrderProductionItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  name: z.string().min(1, 'Nazwa jest wymagana'),
  description: z.string().optional(),
  rateType: ProductionRateTypeSchema.default('FLAT'),
  rateValue: z.number().nonnegative('Stawka nie może być ujemna'),
  units: z.number().positive('Liczba jednostek musi być dodatnia').default(1),
  discount: z.number().min(0).max(100).default(0),
  stageIds: z.string().optional(), // JSON array of stage IDs
  isTransport: z.boolean().default(false),
  isAutoCalculated: z.boolean().default(true),
  isSubcontractor: z.boolean().default(false),
  visibleInOffer: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  /** Opcjonalny koszt marży podwykonawcy: jednostki × koszt netto / jedn.; oba puste = cały netto pozycji */
  marginSubcontractorUnits: z.number().nonnegative().nullable().optional(),
  marginSubcontractorUnitCostNet: z.number().nonnegative().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateOrderProductionItemSchema = OrderProductionItemSchema.omit({
  id: true,
  orderId: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateOrderProductionItemSchema = CreateOrderProductionItemSchema.partial();

// Define OrderSchema with lazy self-references
export const OrderSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    name: z.string().min(1, 'Nazwa zlecenia jest wymagana'),
    description: z.string().optional(),
    notes: z.string().optional(),
    status: OrderStatusSchema.default('DRAFT'),
    venue: z.string().optional(),
    venuePlaceId: z.string().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    clientId: z.string().uuid(),
    client: ClientSchema,
    discountGlobal: z.number().min(0).max(100).default(0),
    vatRate: VatRateOfferSchema.default(23),
    orderYear: z.number().int().optional().nullable(),
    orderNumber: z.number().int().optional().nullable(),
    offerVersion: z.number().int().default(0),
    offerNumber: z.string().optional().nullable(),
    offerValidityDays: z.number().int().min(1).max(90).default(14),
    projectContactKey: ProjectContactKeySchema.optional().nullable(),
    currency: CurrencySchema.default('PLN'),
    exchangeRateEur: z.number().positive().optional().nullable(),
    isRecurring: z.boolean().default(false),
    isDeleted: z.boolean().default(false),
    deletedAt: z.string().datetime().optional().nullable(),
    recurringConfig: z.string().optional(),
    parentOrderId: z.string().uuid().optional(),
    parentOrder: OrderSchema.optional(),
    childOrders: z.array(OrderSchema).optional(),
    stages: z.array(OrderStageSchema).default([]),
    equipmentItems: z.array(OrderEquipmentItemSchema).default([]),
    productionItems: z.array(OrderProductionItemSchema).default([]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
);

export const CreateOrderSchema = z.object({
  name: z.string().min(1, 'Nazwa zlecenia jest wymagana'),
  description: z.string().optional(),
  notes: z.string().optional(),
  status: OrderStatusSchema.default('DRAFT'),
  venue: z.string().optional(),
  venuePlaceId: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  clientId: z.string().uuid(),
  discountGlobal: z.number().min(0).max(100).default(0),
  vatRate: VatRateOfferSchema.default(23),
  offerValidityDays: z.number().int().min(1).max(90).optional(),
  projectContactKey: ProjectContactKeySchema.optional(),
  currency: CurrencySchema.optional(),
  exchangeRateEur: z.number().positive().optional(),
  isRecurring: z.boolean().default(false),
  recurringConfig: z.string().optional(),
  parentOrderId: z.string().uuid().optional(),
  stages: z.array(CreateOrderStageSchema).optional(),
  equipmentItems: z.array(CreateOrderEquipmentItemSchema).optional(),
  productionItems: z.array(CreateOrderProductionItemSchema).optional(),
});

/** W aktualizacji etapy/pozycje mogą mieć id – backend aktualizuje w miejscu zamiast usuwać i tworzyć od zera */
export const UpdateOrderStageItemSchema = CreateOrderStageSchema.extend({
  id: z.string().uuid().optional(),
});
export const UpdateOrderProductionItemItemSchema = CreateOrderProductionItemSchema.extend({
  id: z.string().uuid().optional(),
});

export const UpdateOrderSchema = CreateOrderSchema.omit({
  stages: true,
  productionItems: true,
})
  .partial()
  .extend({
    stages: z.array(UpdateOrderStageItemSchema).optional(),
    productionItems: z.array(UpdateOrderProductionItemItemSchema).optional(),
  });

export type Order = z.infer<typeof OrderSchema>;
export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderDto = z.infer<typeof UpdateOrderSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderStage = z.infer<typeof OrderStageSchema>;
export type CreateOrderStageDto = z.infer<typeof CreateOrderStageSchema>;
export type UpdateOrderStageDto = z.infer<typeof UpdateOrderStageSchema>;
export type OrderEquipmentItem = z.infer<typeof OrderEquipmentItemSchema>;
export type CreateOrderEquipmentItemDto = z.infer<typeof CreateOrderEquipmentItemSchema>;
export type UpdateOrderEquipmentItemDto = z.infer<typeof UpdateOrderEquipmentItemSchema>;
export type OrderProductionItem = z.infer<typeof OrderProductionItemSchema>;
export type CreateOrderProductionItemDto = z.infer<typeof CreateOrderProductionItemSchema>;
export type UpdateOrderProductionItemDto = z.infer<typeof UpdateOrderProductionItemSchema>;
export type ProductionRateType = z.infer<typeof ProductionRateTypeSchema>;
export type StageType = z.infer<typeof StageTypeSchema>;
export type Currency = z.infer<typeof CurrencySchema>;
export type ProjectContactKey = z.infer<typeof ProjectContactKeySchema>;

export const PaginatedOrdersResponseSchema = PaginatedResponseSchema(OrderSchema);
export type PaginatedOrdersResponse = z.infer<typeof PaginatedOrdersResponseSchema>;
