"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateIssuerProfileSchema = exports.CreateIssuerProfileSchema = exports.IssuerProfilePublicSchema = void 0;
const zod_1 = require("zod");
/** Rekord profilu w bazie (API list/detail) — rozszerza dane z draftu o metadane. */
exports.IssuerProfilePublicSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    profileKey: zod_1.z.string().min(1),
    companyName: zod_1.z.string().min(1),
    address: zod_1.z.string().min(1),
    nip: zod_1.z.string().min(1),
    email: zod_1.z.string().min(1),
    phone: zod_1.z.string().optional(),
    isDefault: zod_1.z.boolean(),
    sortOrder: zod_1.z.number().int(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
const profileKeyPattern = /^[A-Za-z0-9_]+$/;
exports.CreateIssuerProfileSchema = zod_1.z.object({
    profileKey: zod_1.z
        .string()
        .trim()
        .min(1)
        .max(80)
        .regex(profileKeyPattern, 'Klucz: tylko litery, cyfry i _')
        .optional(),
    companyName: zod_1.z.string().trim().min(1),
    address: zod_1.z.string().trim().min(1),
    nip: zod_1.z.string().trim().min(1),
    email: zod_1.z.string().trim().min(1),
    phone: zod_1.z.string().trim().optional(),
});
exports.UpdateIssuerProfileSchema = exports.CreateIssuerProfileSchema.omit({ profileKey: true }).partial();
