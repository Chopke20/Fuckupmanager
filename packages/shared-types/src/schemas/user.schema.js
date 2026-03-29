"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginatedInvitationsResponseSchema = exports.PaginatedUsersResponseSchema = exports.InvitationSchema = exports.UserPublicSchema = void 0;
const zod_1 = require("zod");
const permission_schema_1 = require("./permission.schema");
const common_schema_1 = require("./common.schema");
exports.UserPublicSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    username: zod_1.z.string().nullable().optional(),
    email: zod_1.z.string().email(),
    fullName: zod_1.z.string().nullable().optional(),
    role: zod_1.z.string().min(2),
    permissions: zod_1.z.array(permission_schema_1.PermissionSchema).optional(),
    isActive: zod_1.z.boolean(),
    mustChangePassword: zod_1.z.boolean(),
    emailVerifiedAt: zod_1.z.string().datetime().nullable().optional(),
    lastLoginAt: zod_1.z.string().datetime().nullable().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.InvitationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    email: zod_1.z.string().email(),
    role: zod_1.z.string().min(2),
    fullName: zod_1.z.string().nullable().optional(),
    expiresAt: zod_1.z.string().datetime(),
    usedAt: zod_1.z.string().datetime().nullable().optional(),
    createdAt: zod_1.z.string().datetime(),
});
exports.PaginatedUsersResponseSchema = (0, common_schema_1.PaginatedResponseSchema)(exports.UserPublicSchema);
exports.PaginatedInvitationsResponseSchema = (0, common_schema_1.PaginatedResponseSchema)(exports.InvitationSchema);
