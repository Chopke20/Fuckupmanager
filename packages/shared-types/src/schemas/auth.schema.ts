import { z } from 'zod';

export const USER_ROLES = ['ADMIN', 'OPERATOR_FULL'] as const;
export const UserRoleSchema = z.enum(USER_ROLES);

export const LoginRequestSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().trim().email(),
});

export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
  passwordConfirm: z.string().min(8),
}).refine((data) => data.password === data.passwordConfirm, {
  message: 'Hasła muszą być takie same.',
  path: ['passwordConfirm'],
});

export const AcceptInviteRequestSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
  passwordConfirm: z.string().min(8),
}).refine((data) => data.password === data.passwordConfirm, {
  message: 'Hasła muszą być takie same.',
  path: ['passwordConfirm'],
});

export const CreateInvitationRequestSchema = z.object({
  email: z.string().trim().email(),
  role: z.string().trim().min(2).max(64).regex(/^[A-Z0-9_]+$/, 'Rola może zawierać tylko A-Z, 0-9 i _.').default('OPERATOR_FULL'),
  fullName: z.string().trim().min(2).optional(),
});

export type UserRole = z.infer<typeof UserRoleSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
export type AcceptInviteRequest = z.infer<typeof AcceptInviteRequestSchema>;
export type CreateInvitationRequest = z.infer<typeof CreateInvitationRequestSchema>;
