import { prisma } from '../../prisma/client'

interface AuditParams {
  actorUserId: string
  actorEmail: string
  module: string
  action: string
  targetType?: string | null
  targetId?: string | null
  result?: 'SUCCESS' | 'FAILURE'
  details?: string | null
  requestId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: params.actorUserId,
      actorEmail: params.actorEmail,
      module: params.module,
      action: params.action,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      result: params.result ?? 'SUCCESS',
      details: params.details ?? null,
      requestId: params.requestId ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  })
}
