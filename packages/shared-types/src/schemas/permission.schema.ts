import { z } from 'zod';
import { USER_ROLES } from './auth.schema';

export const PERMISSIONS = [
  'clients.read',
  'clients.write',
  'equipment.read',
  'equipment.write',
  'orders.read',
  'orders.write',
  'documents.read',
  'documents.write',
  'blocks.read',
  'blocks.write',
  'calendar.read',
  'calendar.write',
  'finance.read',
  'finance.write',
  'integrations.ai.use',
  'integrations.places.use',
  'admin.users.read',
  'admin.users.write',
  'admin.audit.read',
  'admin.roles.read',
  'admin.roles.write',
  'admin.backup',
] as const;

export const PermissionSchema = z.enum(PERMISSIONS);
export const UserRoleNameSchema = z.enum(USER_ROLES);

export type Permission = z.infer<typeof PermissionSchema>;
export type UserRoleName = z.infer<typeof UserRoleNameSchema>;

export const ROLE_PERMISSION_MAP: Record<UserRoleName, Permission[]> = {
  ADMIN: [...PERMISSIONS],
  OPERATOR_FULL: PERMISSIONS.filter((p) => !p.startsWith('admin.')),
};

export const RoleDefinitionSchema = z.object({
  id: z.string().uuid(),
  roleKey: z.string().min(2),
  displayName: z.string().min(2),
  description: z.string().nullable().optional(),
  permissions: z.array(PermissionSchema),
  isSystem: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateRoleDefinitionSchema = z.object({
  roleKey: z.string().trim().min(2).max(64).regex(/^[A-Z0-9_]+$/, 'Rola może zawierać tylko A-Z, 0-9 i _.'),
  displayName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  permissions: z.array(PermissionSchema).min(1),
});

export const UpdateRoleDefinitionSchema = CreateRoleDefinitionSchema.partial();

export function resolvePermissionsForRole(role: string): Permission[] {
  if (role === 'ADMIN') return ROLE_PERMISSION_MAP.ADMIN;
  if (role === 'OPERATOR_FULL') return ROLE_PERMISSION_MAP.OPERATOR_FULL;
  return [];
}

export function hasPermission(role: string, permission: Permission): boolean {
  return resolvePermissionsForRole(role).includes(permission);
}
