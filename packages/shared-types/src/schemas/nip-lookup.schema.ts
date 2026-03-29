import { z } from 'zod';

export const NipLookupRequestSchema = z.object({
  nip: z.string().min(8).max(32),
});

export const NipCompanyLookupResultSchema = z.object({
  companyName: z.string().min(1),
  address: z.string().min(1),
  nip: z.string().min(1),
  regon: z.string().optional(),
});

export type NipCompanyLookupResultDto = z.infer<typeof NipCompanyLookupResultSchema>;
