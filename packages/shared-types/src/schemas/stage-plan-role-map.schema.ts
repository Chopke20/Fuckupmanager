import { z } from 'zod'

export const STAGE_PLAN_ROLE_ACTIONS = ['map', 'attach', 'skip'] as const
export type StagePlanRoleAction = (typeof STAGE_PLAN_ROLE_ACTIONS)[number]

export const StagePlanRoleMapSchema = z.object({
  id: z.string().uuid(),
  roleKey: z.string().trim().min(1).max(80),
  action: z.enum(STAGE_PLAN_ROLE_ACTIONS),
  equipmentId: z.string().uuid().nullable().optional(),
  attachToRoleKey: z.string().trim().min(1).max(80).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const UpsertStagePlanRoleMapSchema = z
  .object({
    roleKey: z.string().trim().min(1).max(80),
    action: z.enum(STAGE_PLAN_ROLE_ACTIONS),
    equipmentId: z.string().uuid().nullable().optional(),
    attachToRoleKey: z.string().trim().min(1).max(80).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === 'map' && !value.equipmentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Mapowanie wymaga pozycji sprzętu.',
        path: ['equipmentId'],
      })
    }
    if (value.action === 'attach' && !value.attachToRoleKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Dołączenie wymaga roli gospodarza.',
        path: ['attachToRoleKey'],
      })
    }
    if (value.action === 'attach' && value.attachToRoleKey === value.roleKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Rola nie może dołączać do siebie.',
        path: ['attachToRoleKey'],
      })
    }
  })

export const BulkUpsertStagePlanRoleMapsSchema = z.object({
  maps: z.array(UpsertStagePlanRoleMapSchema).max(80),
})

export type StagePlanRoleMap = z.infer<typeof StagePlanRoleMapSchema>
export type UpsertStagePlanRoleMapDto = z.infer<typeof UpsertStagePlanRoleMapSchema>
