import { z } from 'zod';
/** Rekord profilu w bazie (API list/detail) — rozszerza dane z draftu o metadane. */
export const IssuerProfilePublicSchema = z.object({
  id: z.string().uuid(),
  profileKey: z.string().min(1),
  companyName: z.string().min(1),
  address: z.string().min(1),
  nip: z.string().min(1),
  email: z.string().min(1),
  phone: z.string().optional(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type IssuerProfilePublic = z.infer<typeof IssuerProfilePublicSchema>;

const profileKeyPattern = /^[A-Za-z0-9_]+$/;

export const CreateIssuerProfileSchema = z.object({
  profileKey: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(profileKeyPattern, 'Klucz: tylko litery, cyfry i _')
    .optional(),
  companyName: z.string().trim().min(1),
  address: z.string().trim().min(1),
  nip: z.string().trim().min(1),
  email: z.string().trim().min(1),
  phone: z.string().trim().optional(),
});

export const UpdateIssuerProfileSchema = CreateIssuerProfileSchema.omit({ profileKey: true }).partial();

export type CreateIssuerProfileInput = z.infer<typeof CreateIssuerProfileSchema>;
export type UpdateIssuerProfileInput = z.infer<typeof UpdateIssuerProfileSchema>;
