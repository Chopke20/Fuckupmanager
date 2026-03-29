"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateInvitationRequestSchema = exports.AcceptInviteRequestSchema = exports.ResetPasswordRequestSchema = exports.ForgotPasswordRequestSchema = exports.LoginRequestSchema = exports.UserRoleSchema = exports.USER_ROLES = void 0;
const zod_1 = require("zod");
exports.USER_ROLES = ['ADMIN', 'OPERATOR_FULL'];
exports.UserRoleSchema = zod_1.z.enum(exports.USER_ROLES);
exports.LoginRequestSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email(),
    password: zod_1.z.string().min(8),
});
exports.ForgotPasswordRequestSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email(),
});
exports.ResetPasswordRequestSchema = zod_1.z.object({
    token: zod_1.z.string().min(10),
    password: zod_1.z.string().min(8),
    passwordConfirm: zod_1.z.string().min(8),
}).refine((data) => data.password === data.passwordConfirm, {
    message: 'Hasła muszą być takie same.',
    path: ['passwordConfirm'],
});
exports.AcceptInviteRequestSchema = zod_1.z.object({
    token: zod_1.z.string().min(10),
    password: zod_1.z.string().min(8),
    passwordConfirm: zod_1.z.string().min(8),
}).refine((data) => data.password === data.passwordConfirm, {
    message: 'Hasła muszą być takie same.',
    path: ['passwordConfirm'],
});
exports.CreateInvitationRequestSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email(),
    role: zod_1.z.string().trim().min(2).max(64).regex(/^[A-Z0-9_]+$/, 'Rola może zawierać tylko A-Z, 0-9 i _.').default('OPERATOR_FULL'),
    fullName: zod_1.z.string().trim().min(2).optional(),
});
