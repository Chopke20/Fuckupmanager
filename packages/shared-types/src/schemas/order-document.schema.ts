import { z } from 'zod';
import { OrderEquipmentItemSchema, OrderProductionItemSchema, OrderStageSchema } from './order.schema';
import { ClientSchema } from './client.schema';
import { CurrencySchema, ProjectContactKeySchema, VatRateOfferSchema } from './order.schema';

export const DOCUMENT_TYPES = ['OFFER', 'PROPOSAL', 'WAREHOUSE', 'BRIEF'] as const;
export const DocumentTypeSchema = z.enum(DOCUMENT_TYPES);

export const OrderOfferSnapshotSchema = z.object({
  orderId: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  notes: z.string().optional(),
  status: z.string(),
  venue: z.string().optional(),
  venuePlaceId: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  client: ClientSchema,
  discountGlobal: z.number(),
  vatRate: VatRateOfferSchema,
  orderYear: z.number().int().optional().nullable(),
  orderNumber: z.number().int().optional().nullable(),
  offerValidityDays: z.number().int(),
  projectContactKey: ProjectContactKeySchema.optional().nullable(),
  currency: CurrencySchema,
  exchangeRateEur: z.number().positive().optional().nullable(),
  isRecurring: z.boolean().optional(),
  recurringConfig: z.string().optional(),
  stages: z.array(OrderStageSchema),
  equipmentItems: z.array(OrderEquipmentItemSchema),
  productionItems: z.array(OrderProductionItemSchema),
  documentDraft: z.record(z.any()).optional(),
  /** ISO — moment zapisu snapshotu / wygenerowania PDF (opcjonalne dla starych eksportów). */
  generatedAt: z.string().datetime().optional(),
  /** Numer oferty w formacie zlecenie.wersja.rok (jak w `OrderDocumentExport.documentNumber`). */
  documentNumber: z.string().optional(),
});

export const OfferIssuerSchema = z.object({
  profileKey: z.string().default('LAMA_STAGE'),
  companyName: z.string().min(1),
  address: z.string().min(1),
  nip: z.string().min(1),
  email: z.string().min(1),
  phone: z.string().optional(),
});

export const OfferDocumentDraftSchema = z.object({
  offerValidityDays: z.number().int().min(1).max(180),
  projectContactKey: ProjectContactKeySchema.nullable().optional(),
  currency: CurrencySchema,
  exchangeRateEur: z.number().positive().nullable().optional(),
  vatRate: VatRateOfferSchema,
  issuedAt: z.string().datetime().optional(),
  issuer: OfferIssuerSchema,
  /**
   * Tekst widoczny dla klienta w PDF oferty. Gdy pole jest celowo zapisane jako pusty string,
   * blok opisu w PDF pozostaje pusty. Gdy klucza nie ma w zapisanym drafcie (stare rekordy),
   * PDF używa `Order.description` jak dotychczas.
   */
  clientOfferDescription: z.string().max(12000).optional(),
});

export const WarehouseDocumentDraftSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  /** id pozycji sprzętu w zleceniu → zaznaczenie załadunku */
  checked: z.record(z.boolean()).optional(),
});

export const WarehouseSnapshotSchema = z.object({
  orderId: z.string().uuid(),
  orderYear: z.number().int().optional().nullable(),
  orderNumber: z.number().int().optional().nullable(),
  documentType: z.literal('WAREHOUSE'),
  title: z.string(),
  notes: z.string().optional(),
  generatedAt: z.string().datetime(),
  client: ClientSchema,
  venue: z.string().optional(),
  venuePlaceId: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  equipmentItems: z.array(OrderEquipmentItemSchema),
  itemLoadChecked: z.record(z.boolean()).optional(),
});

export const OrderDocumentDraftSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  documentType: DocumentTypeSchema,
  payload: z.record(z.any()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const OrderDocumentExportSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  documentType: DocumentTypeSchema,
  documentNumber: z.string(),
  exportedAt: z.string().datetime(),
  snapshot: OrderOfferSnapshotSchema.or(z.record(z.any())),
  createdAt: z.string().datetime(),
});

export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type OrderOfferSnapshot = z.infer<typeof OrderOfferSnapshotSchema>;
export type OrderDocumentExport = z.infer<typeof OrderDocumentExportSchema>;
export type OfferDocumentDraft = z.infer<typeof OfferDocumentDraftSchema>;
export type WarehouseDocumentDraft = z.infer<typeof WarehouseDocumentDraftSchema>;
export type OrderDocumentDraft = z.infer<typeof OrderDocumentDraftSchema>;

