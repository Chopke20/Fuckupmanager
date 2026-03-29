import { z } from 'zod';
import { PermissionSchema } from './permission.schema';
import { PaginatedResponseSchema } from './common.schema';

export const UserPublicSchema = z.object({
  id: z.string().uuid(),
  username: z.string().nullable().optional(),
  email: z.string().email(),
  fullName: z.string().nullable().optional(),
  role: z.string().min(2),
  permissions: z.array(PermissionSchema).optional(),
  isActive: z.boolean(),
  mustChangePassword: z.boolean(),
  emailVerifiedAt: z.string().datetime().nullable().optional(),
  lastLoginAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const InvitationSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.string().min(2),
  fullName: z.string().nullable().optional(),
  expiresAt: z.string().datetime(),
  usedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const PaginatedUsersResponseSchema = PaginatedResponseSchema(UserPublicSchema);
export const PaginatedInvitationsResponseSchema = PaginatedResponseSchema(InvitationSchema);

export type UserPublic = z.infer<typeof UserPublicSchema>;
export type Invitation = z.infer<typeof InvitationSchema>;
