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

/** Moja pozycja pokazywana partnerowi — WYŁĄCZNIE te pola. */
export const SharedOfferLockedLineSchema = z.object({
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
});

export const SharedOfferBlockSchema = z.object({
  id: z.string(),
  title: z.string(),
  sortOrder: z.number(),
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
  venue: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  clientCompanyName: z.string().nullable(),
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
