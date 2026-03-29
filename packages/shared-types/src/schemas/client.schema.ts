import { z } from 'zod';
import { PaginatedResponseSchema } from './common.schema';

export const ClientSchema = z.object({
  id: z.string().uuid(),
  companyName: z.string().min(1, 'Nazwa firmy jest wymagana'),
  contactName: z.string().optional(),
  address: z.string().optional(),
  nip: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateClientSchema = ClientSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateClientSchema = CreateClientSchema.partial();

export type Client = z.infer<typeof ClientSchema>;
export type CreateClientDto = z.infer<typeof CreateClientSchema>;
export type UpdateClientDto = z.infer<typeof UpdateClientSchema>;

export const PaginatedClientsResponseSchema = PaginatedResponseSchema(ClientSchema);
export type PaginatedClientsResponse = z.infer<typeof PaginatedClientsResponseSchema>;
