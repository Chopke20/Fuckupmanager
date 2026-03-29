"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NipCompanyLookupResultSchema = exports.NipLookupRequestSchema = void 0;
const zod_1 = require("zod");
exports.NipLookupRequestSchema = zod_1.z.object({
    nip: zod_1.z.string().min(8).max(32),
});
exports.NipCompanyLookupResultSchema = zod_1.z.object({
    companyName: zod_1.z.string().min(1),
    address: zod_1.z.string().min(1),
    nip: zod_1.z.string().min(1),
    regon: zod_1.z.string().optional(),
});
