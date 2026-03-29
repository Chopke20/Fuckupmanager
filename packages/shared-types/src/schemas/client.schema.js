"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginatedClientsResponseSchema = exports.UpdateClientSchema = exports.CreateClientSchema = exports.ClientSchema = void 0;
const zod_1 = require("zod");
const common_schema_1 = require("./common.schema");
exports.ClientSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    companyName: zod_1.z.string().min(1, 'Nazwa firmy jest wymagana'),
    contactName: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    nip: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.CreateClientSchema = exports.ClientSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.UpdateClientSchema = exports.CreateClientSchema.partial();
exports.PaginatedClientsResponseSchema = (0, common_schema_1.PaginatedResponseSchema)(exports.ClientSchema);
