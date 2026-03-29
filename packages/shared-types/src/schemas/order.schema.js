"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginatedOrdersResponseSchema = exports.UpdateOrderSchema = exports.UpdateOrderProductionItemItemSchema = exports.UpdateOrderStageItemSchema = exports.CreateOrderSchema = exports.OrderSchema = exports.UpdateOrderProductionItemSchema = exports.CreateOrderProductionItemSchema = exports.OrderProductionItemSchema = exports.ProductionRateTypeSchema = exports.PRODUCTION_RATE_TYPES = exports.VatRateOfferSchema = exports.VAT_RATES_OFFER = exports.ProjectContactKeySchema = exports.PROJECT_CONTACT_KEYS = exports.CurrencySchema = exports.CURRENCIES = exports.UpdateOrderEquipmentItemSchema = exports.CreateOrderEquipmentItemSchema = exports.OrderEquipmentItemSchema = exports.UpdateOrderStageSchema = exports.CreateOrderStageSchema = exports.OrderStageSchema = exports.StageTypeSchema = exports.STAGE_TYPES = exports.OrderStatusSchema = exports.ORDER_STATUSES = void 0;
const zod_1 = require("zod");
const client_schema_1 = require("./client.schema");
const equipment_schema_1 = require("./equipment.schema");
const common_schema_1 = require("./common.schema");
exports.ORDER_STATUSES = [
    'DRAFT',
    'OFFER_SENT',
    'CONFIRMED',
    'COMPLETED',
    'CANCELLED',
    'ARCHIVED',
];
exports.OrderStatusSchema = zod_1.z.enum(exports.ORDER_STATUSES);
exports.STAGE_TYPES = [
    'MONTAZ',
    'EVENT',
    'DEMONTAZ',
    'CUSTOM',
];
exports.StageTypeSchema = zod_1.z.enum(exports.STAGE_TYPES);
exports.OrderStageSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid(),
    type: exports.StageTypeSchema.default('CUSTOM'),
    label: zod_1.z.string().optional(),
    date: zod_1.z.string().datetime(),
    timeStart: zod_1.z.string().optional(),
    timeEnd: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    sortOrder: zod_1.z.number().int().default(0),
    createdAt: zod_1.z.string().datetime(),
});
exports.CreateOrderStageSchema = exports.OrderStageSchema.omit({
    id: true,
    orderId: true,
    createdAt: true,
}).extend({
    date: zod_1.z.union([zod_1.z.string().datetime(), zod_1.z.coerce.date(), zod_1.z.date()]),
});
exports.UpdateOrderStageSchema = exports.CreateOrderStageSchema.partial();
exports.OrderEquipmentItemSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid(),
    equipmentId: zod_1.z.string().uuid().optional(),
    equipment: equipment_schema_1.EquipmentSchema.optional(),
    name: zod_1.z.string().min(1, 'Nazwa jest wymagana'),
    description: zod_1.z.string().optional(),
    category: zod_1.z.string().default('Inne'),
    quantity: zod_1.z.number().int().positive('Ilość musi być dodatnia'),
    unitPrice: zod_1.z.number().nonnegative('Cena jednostkowa nie może być ujemna'),
    days: zod_1.z.number().int().positive('Liczba dni musi być dodatnia').default(1),
    discount: zod_1.z.number().min(0).max(100).default(0),
    pricingRule: zod_1.z.object({
        day1: zod_1.z.number().min(0).default(1.0),
        nextDays: zod_1.z.number().min(0).default(0.5),
    }).optional(),
    visibleInOffer: zod_1.z.boolean().default(true),
    isRental: zod_1.z.boolean().default(false), // wynajem – bez marży (koszt = przychód)
    sortOrder: zod_1.z.number().int().default(0),
    // Individual reservation dates for equipment availability checks
    dateFrom: zod_1.z.string().datetime().optional(),
    dateTo: zod_1.z.string().datetime().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.CreateOrderEquipmentItemSchema = exports.OrderEquipmentItemSchema.omit({
    id: true,
    orderId: true,
    equipment: true,
    createdAt: true,
    updatedAt: true,
});
exports.UpdateOrderEquipmentItemSchema = exports.CreateOrderEquipmentItemSchema.partial();
exports.CURRENCIES = ['PLN', 'EUR'];
exports.CurrencySchema = zod_1.z.enum(exports.CURRENCIES);
exports.PROJECT_CONTACT_KEYS = ['RAFAL', 'MICHAL'];
exports.ProjectContactKeySchema = zod_1.z.enum(exports.PROJECT_CONTACT_KEYS);
exports.VAT_RATES_OFFER = [0, 23];
exports.VatRateOfferSchema = zod_1.z.union([zod_1.z.literal(0), zod_1.z.literal(23)]);
exports.PRODUCTION_RATE_TYPES = [
    'DAILY',
    'HOURLY',
    'FLAT',
];
exports.ProductionRateTypeSchema = zod_1.z.enum(exports.PRODUCTION_RATE_TYPES);
exports.OrderProductionItemSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1, 'Nazwa jest wymagana'),
    description: zod_1.z.string().optional(),
    rateType: exports.ProductionRateTypeSchema.default('FLAT'),
    rateValue: zod_1.z.number().nonnegative('Stawka nie może być ujemna'),
    units: zod_1.z.number().positive('Liczba jednostek musi być dodatnia').default(1),
    discount: zod_1.z.number().min(0).max(100).default(0),
    stageIds: zod_1.z.string().optional(), // JSON array of stage IDs
    isTransport: zod_1.z.boolean().default(false),
    isAutoCalculated: zod_1.z.boolean().default(true),
    isSubcontractor: zod_1.z.boolean().default(false),
    visibleInOffer: zod_1.z.boolean().default(true),
    sortOrder: zod_1.z.number().int().default(0),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.CreateOrderProductionItemSchema = exports.OrderProductionItemSchema.omit({
    id: true,
    orderId: true,
    createdAt: true,
    updatedAt: true,
});
exports.UpdateOrderProductionItemSchema = exports.CreateOrderProductionItemSchema.partial();
// Define OrderSchema with lazy self-references
exports.OrderSchema = zod_1.z.lazy(() => zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1, 'Nazwa zlecenia jest wymagana'),
    description: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    status: exports.OrderStatusSchema.default('DRAFT'),
    venue: zod_1.z.string().optional(),
    venuePlaceId: zod_1.z.string().optional(),
    startDate: zod_1.z.coerce.date(),
    endDate: zod_1.z.coerce.date(),
    clientId: zod_1.z.string().uuid(),
    client: client_schema_1.ClientSchema,
    discountGlobal: zod_1.z.number().min(0).max(100).default(0),
    vatRate: exports.VatRateOfferSchema.default(23),
    orderYear: zod_1.z.number().int().optional().nullable(),
    orderNumber: zod_1.z.number().int().optional().nullable(),
    offerVersion: zod_1.z.number().int().default(0),
    offerNumber: zod_1.z.string().optional().nullable(),
    offerValidityDays: zod_1.z.number().int().min(1).max(90).default(14),
    projectContactKey: exports.ProjectContactKeySchema.optional().nullable(),
    currency: exports.CurrencySchema.default('PLN'),
    exchangeRateEur: zod_1.z.number().positive().optional().nullable(),
    isRecurring: zod_1.z.boolean().default(false),
    isDeleted: zod_1.z.boolean().default(false),
    deletedAt: zod_1.z.string().datetime().optional().nullable(),
    recurringConfig: zod_1.z.string().optional(),
    parentOrderId: zod_1.z.string().uuid().optional(),
    parentOrder: exports.OrderSchema.optional(),
    childOrders: zod_1.z.array(exports.OrderSchema).optional(),
    stages: zod_1.z.array(exports.OrderStageSchema).default([]),
    equipmentItems: zod_1.z.array(exports.OrderEquipmentItemSchema).default([]),
    productionItems: zod_1.z.array(exports.OrderProductionItemSchema).default([]),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
}));
exports.CreateOrderSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Nazwa zlecenia jest wymagana'),
    description: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    status: exports.OrderStatusSchema.default('DRAFT'),
    venue: zod_1.z.string().optional(),
    venuePlaceId: zod_1.z.string().optional(),
    startDate: zod_1.z.coerce.date(),
    endDate: zod_1.z.coerce.date(),
    clientId: zod_1.z.string().uuid(),
    discountGlobal: zod_1.z.number().min(0).max(100).default(0),
    vatRate: exports.VatRateOfferSchema.default(23),
    offerValidityDays: zod_1.z.number().int().min(1).max(90).optional(),
    projectContactKey: exports.ProjectContactKeySchema.optional(),
    currency: exports.CurrencySchema.optional(),
    exchangeRateEur: zod_1.z.number().positive().optional(),
    isRecurring: zod_1.z.boolean().default(false),
    recurringConfig: zod_1.z.string().optional(),
    parentOrderId: zod_1.z.string().uuid().optional(),
    stages: zod_1.z.array(exports.CreateOrderStageSchema).optional(),
    equipmentItems: zod_1.z.array(exports.CreateOrderEquipmentItemSchema).optional(),
    productionItems: zod_1.z.array(exports.CreateOrderProductionItemSchema).optional(),
});
/** W aktualizacji etapy/pozycje mogą mieć id – backend aktualizuje w miejscu zamiast usuwać i tworzyć od zera */
exports.UpdateOrderStageItemSchema = exports.CreateOrderStageSchema.extend({
    id: zod_1.z.string().uuid().optional(),
});
exports.UpdateOrderProductionItemItemSchema = exports.CreateOrderProductionItemSchema.extend({
    id: zod_1.z.string().uuid().optional(),
});
exports.UpdateOrderSchema = exports.CreateOrderSchema.omit({
    stages: true,
    productionItems: true,
})
    .partial()
    .extend({
    stages: zod_1.z.array(exports.UpdateOrderStageItemSchema).optional(),
    productionItems: zod_1.z.array(exports.UpdateOrderProductionItemItemSchema).optional(),
});
exports.PaginatedOrdersResponseSchema = (0, common_schema_1.PaginatedResponseSchema)(exports.OrderSchema);
