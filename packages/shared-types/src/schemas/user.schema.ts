import { z } from 'zod';
import { PermissionSchema } from './permission.schema';
import { PaginatedResponseSchema } from './common.schema';

export const UserPublicSchema = z.object({
  id: z.string().uuid(),
  companyCode: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,32}$/),
  brandName: z.string().trim().min(1),
  logoDarkBgUrl: z.string().trim().url().nullable().optional(),
  logoLightBgUrl: z.string().trim().url().nullable().optional(),
  sidebarLogoVariant: z.enum(['DARK', 'LIGHT']).nullable().optional(),
  loginLogoVariant: z.enum(['DARK', 'LIGHT']).nullable().optional(),
  documentsLogoVariant: z.enum(['DARK', 'LIGHT']).nullable().optional(),
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
