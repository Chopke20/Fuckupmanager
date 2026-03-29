"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginatedAuditLogsResponseSchema = exports.AuditLogSchema = void 0;
const zod_1 = require("zod");
const common_schema_1 = require("./common.schema");
exports.AuditLogSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    actorUserId: zod_1.z.string().uuid(),
    actorEmail: zod_1.z.string().email(),
    module: zod_1.z.string(),
    action: zod_1.z.string(),
    targetType: zod_1.z.string().nullable().optional(),
    targetId: zod_1.z.string().nullable().optional(),
    result: zod_1.z.enum(['SUCCESS', 'FAILURE']),
    details: zod_1.z.string().nullable().optional(),
    requestId: zod_1.z.string().nullable().optional(),
    ipAddress: zod_1.z.string().nullable().optional(),
    userAgent: zod_1.z.string().nullable().optional(),
    createdAt: zod_1.z.string().datetime(),
});
exports.PaginatedAuditLogsResponseSchema = (0, common_schema_1.PaginatedResponseSchema)(exports.AuditLogSchema);
