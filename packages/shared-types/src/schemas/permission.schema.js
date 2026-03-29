"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRoleDefinitionSchema = exports.CreateRoleDefinitionSchema = exports.RoleDefinitionSchema = exports.ROLE_PERMISSION_MAP = exports.UserRoleNameSchema = exports.PermissionSchema = exports.PERMISSIONS = void 0;
exports.resolvePermissionsForRole = resolvePermissionsForRole;
exports.hasPermission = hasPermission;
const zod_1 = require("zod");
const auth_schema_1 = require("./auth.schema");
exports.PERMISSIONS = [
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
];
exports.PermissionSchema = zod_1.z.enum(exports.PERMISSIONS);
exports.UserRoleNameSchema = zod_1.z.enum(auth_schema_1.USER_ROLES);
exports.ROLE_PERMISSION_MAP = {
    ADMIN: [...exports.PERMISSIONS],
    OPERATOR_FULL: exports.PERMISSIONS.filter((p) => !p.startsWith('admin.')),
};
exports.RoleDefinitionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    roleKey: zod_1.z.string().min(2),
    displayName: zod_1.z.string().min(2),
    description: zod_1.z.string().nullable().optional(),
    permissions: zod_1.z.array(exports.PermissionSchema),
    isSystem: zod_1.z.boolean(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.CreateRoleDefinitionSchema = zod_1.z.object({
    roleKey: zod_1.z.string().trim().min(2).max(64).regex(/^[A-Z0-9_]+$/, 'Rola może zawierać tylko A-Z, 0-9 i _.'),
    displayName: zod_1.z.string().trim().min(2).max(120),
    description: zod_1.z.string().trim().max(500).optional(),
    permissions: zod_1.z.array(exports.PermissionSchema).min(1),
});
exports.UpdateRoleDefinitionSchema = exports.CreateRoleDefinitionSchema.partial();
function resolvePermissionsForRole(role) {
    if (role === 'ADMIN')
        return exports.ROLE_PERMISSION_MAP.ADMIN;
    if (role === 'OPERATOR_FULL')
        return exports.ROLE_PERMISSION_MAP.OPERATOR_FULL;
    return [];
}
function hasPermission(role, permission) {
    return resolvePermissionsForRole(role).includes(permission);
}
