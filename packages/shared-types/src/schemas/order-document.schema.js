"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderDocumentExportSchema = exports.OrderDocumentDraftSchema = exports.WarehouseSnapshotSchema = exports.WarehouseDocumentDraftSchema = exports.OfferDocumentDraftSchema = exports.OfferIssuerSchema = exports.OrderOfferSnapshotSchema = exports.DocumentTypeSchema = exports.DOCUMENT_TYPES = void 0;
const zod_1 = require("zod");
const order_schema_1 = require("./order.schema");
const client_schema_1 = require("./client.schema");
const order_schema_2 = require("./order.schema");
exports.DOCUMENT_TYPES = ['OFFER', 'PROPOSAL', 'WAREHOUSE', 'BRIEF'];
exports.DocumentTypeSchema = zod_1.z.enum(exports.DOCUMENT_TYPES);
exports.OrderOfferSnapshotSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    status: zod_1.z.string(),
    venue: zod_1.z.string().optional(),
    venuePlaceId: zod_1.z.string().optional(),
    startDate: zod_1.z.string().datetime(),
    endDate: zod_1.z.string().datetime(),
    client: client_schema_1.ClientSchema,
    discountGlobal: zod_1.z.number(),
    vatRate: order_schema_2.VatRateOfferSchema,
    orderYear: zod_1.z.number().int().optional().nullable(),
    orderNumber: zod_1.z.number().int().optional().nullable(),
    offerValidityDays: zod_1.z.number().int(),
    projectContactKey: order_schema_2.ProjectContactKeySchema.optional().nullable(),
    currency: order_schema_2.CurrencySchema,
    exchangeRateEur: zod_1.z.number().positive().optional().nullable(),
    isRecurring: zod_1.z.boolean().optional(),
    recurringConfig: zod_1.z.string().optional(),
    stages: zod_1.z.array(order_schema_1.OrderStageSchema),
    equipmentItems: zod_1.z.array(order_schema_1.OrderEquipmentItemSchema),
    productionItems: zod_1.z.array(order_schema_1.OrderProductionItemSchema),
    documentDraft: zod_1.z.record(zod_1.z.any()).optional(),
    /** ISO — moment zapisu snapshotu / wygenerowania PDF (opcjonalne dla starych eksportów). */
    generatedAt: zod_1.z.string().datetime().optional(),
    /** Numer oferty w formacie zlecenie.wersja.rok (jak w `OrderDocumentExport.documentNumber`). */
    documentNumber: zod_1.z.string().optional(),
});
exports.OfferIssuerSchema = zod_1.z.object({
    profileKey: zod_1.z.string().default('LAMA_STAGE'),
    companyName: zod_1.z.string().min(1),
    address: zod_1.z.string().min(1),
    nip: zod_1.z.string().min(1),
    email: zod_1.z.string().min(1),
    phone: zod_1.z.string().optional(),
});
exports.OfferDocumentDraftSchema = zod_1.z.object({
    offerValidityDays: zod_1.z.number().int().min(1).max(180),
    projectContactKey: order_schema_2.ProjectContactKeySchema.nullable().optional(),
    currency: order_schema_2.CurrencySchema,
    exchangeRateEur: zod_1.z.number().positive().nullable().optional(),
    vatRate: order_schema_2.VatRateOfferSchema,
    issuedAt: zod_1.z.string().datetime().optional(),
    issuer: exports.OfferIssuerSchema,
});
exports.WarehouseDocumentDraftSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    notes: zod_1.z.string().optional(),
});
exports.WarehouseSnapshotSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    orderYear: zod_1.z.number().int().optional().nullable(),
    orderNumber: zod_1.z.number().int().optional().nullable(),
    documentType: zod_1.z.literal('WAREHOUSE'),
    title: zod_1.z.string(),
    notes: zod_1.z.string().optional(),
    generatedAt: zod_1.z.string().datetime(),
    client: client_schema_1.ClientSchema,
    venue: zod_1.z.string().optional(),
    venuePlaceId: zod_1.z.string().optional(),
    startDate: zod_1.z.string().datetime(),
    endDate: zod_1.z.string().datetime(),
    equipmentItems: zod_1.z.array(order_schema_1.OrderEquipmentItemSchema),
});
exports.OrderDocumentDraftSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid(),
    documentType: exports.DocumentTypeSchema,
    payload: zod_1.z.record(zod_1.z.any()),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.OrderDocumentExportSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid(),
    documentType: exports.DocumentTypeSchema,
    documentNumber: zod_1.z.string(),
    exportedAt: zod_1.z.string().datetime(),
    snapshot: exports.OrderOfferSnapshotSchema.or(zod_1.z.record(zod_1.z.any())),
    createdAt: zod_1.z.string().datetime(),
});
