"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginatedResponseSchema = exports.SearchSchema = exports.PaginationSchema = exports.DateRangeSchema = exports.IdSchema = exports.PaginationMetaSchema = void 0;
const zod_1 = require("zod");
exports.PaginationMetaSchema = zod_1.z.object({
    total: zod_1.z.number().int().nonnegative(),
    page: zod_1.z.number().int().positive(),
    lastPage: zod_1.z.number().int().positive(),
});
exports.IdSchema = zod_1.z.string().uuid();
exports.DateRangeSchema = zod_1.z.object({
    from: zod_1.z.string().datetime(),
    to: zod_1.z.string().datetime(),
});
exports.PaginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(500).default(20),
});
exports.SearchSchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
});
const PaginatedResponseSchema = (itemSchema) => zod_1.z.object({
    data: zod_1.z.object({
        data: zod_1.z.array(itemSchema),
        meta: exports.PaginationMetaSchema,
    })
});
exports.PaginatedResponseSchema = PaginatedResponseSchema;
