"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginatedEquipmentResponseSchema = exports.EquipmentResponseSchema = exports.UpdateEquipmentSchema = exports.CreateEquipmentSchema = exports.EquipmentSchema = exports.PricingRuleSchema = exports.EquipmentCategorySchema = exports.EQUIPMENT_CATEGORIES = void 0;
const zod_1 = require("zod");
const common_schema_1 = require("./common.schema");
exports.EQUIPMENT_CATEGORIES = [
    'Audio',
    'Multimedia',
    'Oświetlenie',
    'Scena',
    'Transport',
    'Inne',
];
exports.EquipmentCategorySchema = zod_1.z.string().trim().min(1).default('Inne');
exports.PricingRuleSchema = zod_1.z.union([
    zod_1.z.object({
        day1: zod_1.z.number().min(0).default(1.0),
        nextDays: zod_1.z.number().min(0).default(0.5),
    }),
    zod_1.z.string().transform(str => JSON.parse(str))
]).optional();
exports.EquipmentSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1, 'Nazwa jest wymagana'),
    description: zod_1.z.string().optional(),
    category: exports.EquipmentCategorySchema,
    subcategory: zod_1.z.string().trim().min(1).optional(),
    dailyPrice: zod_1.z.number().nonnegative('Cena dzienna nie może być ujemna'),
    stockQuantity: zod_1.z.number().int().nonnegative('Stan magazynowy nie może być ujemny'),
    unit: zod_1.z.string().default('szt.'),
    internalCode: zod_1.z.string().optional(),
    technicalNotes: zod_1.z.string().optional(),
    imageUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    visibleInOffer: zod_1.z.boolean().default(true),
    pricingRule: exports.PricingRuleSchema,
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.CreateEquipmentSchema = exports.EquipmentSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.UpdateEquipmentSchema = exports.CreateEquipmentSchema.partial();
exports.EquipmentResponseSchema = zod_1.z.object({
    data: exports.EquipmentSchema,
    meta: common_schema_1.PaginationMetaSchema
});
exports.PaginatedEquipmentResponseSchema = zod_1.z.object({
    data: zod_1.z.array(exports.EquipmentSchema),
    meta: common_schema_1.PaginationMetaSchema
});
