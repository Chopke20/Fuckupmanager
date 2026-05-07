import { OrderStage } from '@lama-stage/shared-types'

const STAGE_TYPE_LABELS: Record<string, string> = {
  MONTAZ: 'Montaż',
  EVENT: 'Wydarzenie',
  DEMONTAZ: 'Demontaż',
  PROBA: 'Próba',
  CUSTOM: 'Inny',
}

export function stageTypeToLabel(type?: string | null): string {
  if (!type) return 'Etap'
  return STAGE_TYPE_LABELS[type] ?? type
}

export function stageToDisplayLabel(stage?: Partial<OrderStage> | null): string {
  if (!stage) return 'Etap'
  const custom = String(stage.label || '').trim()
  if (custom) return custom
  return stageTypeToLabel(stage.type)
}
