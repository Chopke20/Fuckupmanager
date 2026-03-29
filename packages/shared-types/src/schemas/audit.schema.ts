import { z } from 'zod';
import { PaginatedResponseSchema } from './common.schema';

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  actorUserId: z.string().uuid(),
  actorEmail: z.string().email(),
  module: z.string(),
  action: z.string(),
  targetType: z.string().nullable().optional(),
  targetId: z.string().nullable().optional(),
  result: z.enum(['SUCCESS', 'FAILURE']),
  details: z.string().nullable().optional(),
  requestId: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const PaginatedAuditLogsResponseSchema = PaginatedResponseSchema(AuditLogSchema);

export type AuditLog = z.infer<typeof AuditLogSchema>;
