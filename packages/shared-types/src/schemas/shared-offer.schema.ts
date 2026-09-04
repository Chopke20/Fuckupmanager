import { z } from 'zod';

export const SHARED_OFFER_LINE_KINDS = ['EQUIPMENT', 'PRODUCTION'] as const;
export const SharedOfferLineKindSchema = z.enum(SHARED_OFFER_LINE_KINDS);

/** Twarde limity — endpoint jest publiczny, bez logowania. */
export const MAX_SHARED_OFFER_LINES = 60;

/**
 * Pozycja dodana przez partnera. Jeden ujednolicony kształt dla obu rodzajów;
 * mapowanie na pozycje sprzętowe/produkcyjne odbywa się przy generowaniu PDF.
 */
export const SharedOfferPartnerLineSchema = z.object({
  id: z.string().min(1).max(64),
  kind: SharedOfferLineKindSchema.default('PRODUCTION'),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).default(''),
  category: z.string().trim().max(80).default('Inne'),
  quantity: z.number().finite().min(0).max(10_000).default(1),
  unitPrice: z.number().finite().min(0).max(10_000_000).default(0),
  days: z.number().int().min(1).max(365).default(1),
  discount: z.number().finite().min(0).max(100).default(0),
  offerBlockId: z.string().uuid().nullable().default(null),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const SharedOfferPartnerPayloadSchema = z.object({
  lines: z.array(SharedOfferPartnerLineSchema).max(MAX_SHARED_OFFER_LINES).default([]),
});

/** Etap harmonogramu zapisywany z edytora publicznego — trafia do zlecenia Lama. */
export const SharedOfferSaveStageSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.string().trim().min(1).max(40).default('CUSTOM'),
  label: z.string().trim().max(200).nullable().optional(),
  date: z.union([z.string().datetime(), z.string().min(1).max(40)]),
  timeStart: z.string().trim().max(16).nullable().optional(),
  timeEnd: z.string().trim().max(16).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const SharedOfferSaveBodySchema = z.object({
  lines: z.array(SharedOfferPartnerLineSchema).max(MAX_SHARED_OFFER_LINES),
  lockedFingerprint: z.string().min(1).max(128).optional(),
  /** Opis zlecenia — partner może edytować; zapis do Order.description. */
  description: z.string().max(10_000).nullable().optional(),
  /** Harmonogram — partner może budować; zapis do OrderStage. */
  stages: z.array(SharedOfferSaveStageSchema).max(80).optional(),
});

/** Moja pozycja pokazywana partnerowi — WYŁĄCZNIE te pola. */
export const SharedOfferLockedLineSchema = z.object({
  /** Stabilne id z OrderEquipmentItem / OrderProductionItem — do locków w UI. */
  id: z.string().uuid(),
  kind: SharedOfferLineKindSchema,
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  quantity: z.number(),
  unitPrice: z.number(),
  days: z.number(),
  discount: z.number(),
  offerBlockId: z.string().nullable(),
  unit: z.string().nullable(),
  sortOrder: z.number().int().default(0),
  isTransport: z.boolean().optional(),
  rateType: z.string().optional(),
  stageIds: z.string().nullable().optional(),
});

export const SharedOfferBlockSchema = z.object({
  id: z.string(),
  title: z.string(),
  sortOrder: z.number(),
});

export const SharedOfferStageSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  label: z.string().nullable().optional(),
  date: z.string(),
  timeStart: z.string().nullable().optional(),
  timeEnd: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export const SharedOfferTotalsSchema = z.object({
  ownNet: z.number(),
  partnerNet: z.number(),
  totalNet: z.number(),
  vatRate: z.number(),
  vatAmount: z.number(),
  grossTotal: z.number(),
  discountGlobal: z.number(),
  currency: z.string(),
});

export const SharedOfferPublicViewSchema = z.object({
  status: z.enum(['ACTIVE', 'REVOKED']),
  orderName: z.string(),
  orderStatus: z.string(),
  orderNumber: z.number().int().nullable(),
  orderYear: z.number().int().nullable(),
  description: z.string().nullable(),
  venue: z.string().nullable(),
  venuePlaceId: z.string().nullable(),
  dateFrom: z.string(),
  dateTo: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  clientCompanyName: z.string().nullable(),
  brandAccentHex: z.string().default('#81B29F'),
  stages: z.array(SharedOfferStageSchema).default([]),
  blocks: z.array(SharedOfferBlockSchema),
  lockedLines: z.array(SharedOfferLockedLineSchema),
  partnerLines: z.array(SharedOfferPartnerLineSchema),
  totals: SharedOfferTotalsSchema,
  lastSavedAt: z.string().nullable(),
  /** Odcisk moich pozycji — do detekcji zmian po stronie operatora. */
  lockedFingerprint: z.string(),
});

export type SharedOfferLineKind = z.infer<typeof SharedOfferLineKindSchema>;
export type SharedOfferPartnerLine = z.infer<typeof SharedOfferPartnerLineSchema>;
export type SharedOfferPartnerPayload = z.infer<typeof SharedOfferPartnerPayloadSchema>;
export type SharedOfferLockedLine = z.infer<typeof SharedOfferLockedLineSchema>;
export type SharedOfferPublicView = z.infer<typeof SharedOfferPublicViewSchema>;
export type SharedOfferTotals = z.infer<typeof SharedOfferTotalsSchema>;
export type SharedOfferStage = z.infer<typeof SharedOfferStageSchema>;
export type SharedOfferSaveStage = z.infer<typeof SharedOfferSaveStageSchema>;
export type SharedOfferSaveBody = z.infer<typeof SharedOfferSaveBodySchema>;
