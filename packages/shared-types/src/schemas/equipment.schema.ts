import { z } from 'zod';
import { PaginationMetaSchema } from './common.schema';

export const EQUIPMENT_CATEGORIES = [
  'Audio',
  'Multimedia',
  'Oświetlenie',
  'Scena',
  'Transport',
  'Inne',
] as const;

export const EquipmentCategorySchema = z.string().trim().min(1).default('Inne');

export const PricingRuleSchema = z.union([
  z.object({
    day1: z.number().min(0).default(1.0),
    nextDays: z.number().min(0).default(0.5),
  }),
  z.string().transform(str => JSON.parse(str))
]).optional();

export const EquipmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Nazwa jest wymagana'),
  description: z.string().optional(),
  category: EquipmentCategorySchema,
  subcategory: z.string().trim().min(1).optional(),
  dailyPrice: z.number().nonnegative('Cena dzienna nie może być ujemna'),
  stockQuantity: z.number().int().nonnegative('Stan magazynowy nie może być ujemny'),
  unit: z.string().default('szt.'),
  internalCode: z.string().optional(),
  technicalNotes: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  visibleInOffer: z.boolean().default(true),
  pricingRule: PricingRuleSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateEquipmentSchema = EquipmentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateEquipmentSchema = CreateEquipmentSchema.partial();

export type Equipment = z.infer<typeof EquipmentSchema>;
export type CreateEquipmentDto = z.infer<typeof CreateEquipmentSchema>;
export type UpdateEquipmentDto = z.infer<typeof UpdateEquipmentSchema>;
export type EquipmentCategory = z.infer<typeof EquipmentCategorySchema>;
export type PricingRule = z.infer<typeof PricingRuleSchema>;

export const EquipmentResponseSchema = z.object({
  data: EquipmentSchema,
  meta: PaginationMetaSchema
});

export const PaginatedEquipmentResponseSchema = z.object({
  data: z.array(EquipmentSchema),
  meta: PaginationMetaSchema
});

export type EquipmentResponse = z.infer<typeof EquipmentResponseSchema>;
export type PaginatedEquipmentResponse = z.infer<typeof PaginatedEquipmentResponseSchema>;
