import { z } from 'zod';

export const USER_ROLES = ['ADMIN', 'OPERATOR_FULL'] as const;
export const UserRoleSchema = z.enum(USER_ROLES);
export const CompanyCodeSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,32}$/);

export const LoginRequestSchema = z.object({
  companyCode: CompanyCodeSchema,
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export const ForgotPasswordRequestSchema = z.object({
  companyCode: CompanyCodeSchema,
  email: z.string().trim().email(),
});

export const ResetPasswordRequestSchema = z.object({
  companyCode: CompanyCodeSchema,
  token: z.string().min(10),
  password: z.string().min(8),
  passwordConfirm: z.string().min(8),
}).refine((data) => data.password === data.passwordConfirm, {
  message: 'Hasła muszą być takie same.',
  path: ['passwordConfirm'],
});

export const AcceptInviteRequestSchema = z.object({
  companyCode: CompanyCodeSchema,
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

export const PublicCompanySchema = z.object({
  code: CompanyCodeSchema,
  displayName: z.string().trim().min(1),
  logoDarkBgUrl: z.string().trim().url().nullable().optional(),
  logoLightBgUrl: z.string().trim().url().nullable().optional(),
  loginLogoVariant: z.enum(['DARK', 'LIGHT']).nullable().optional(),
  primaryColorHex: z.string().trim().regex(/^#?[0-9a-fA-F]{6}$/).nullable().optional(),
  loginHelpText: z.string().trim().max(240).nullable().optional(),
});

export type UserRole = z.infer<typeof UserRoleSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
export type AcceptInviteRequest = z.infer<typeof AcceptInviteRequestSchema>;
export type CreateInvitationRequest = z.infer<typeof CreateInvitationRequestSchema>;
