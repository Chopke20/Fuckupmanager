/** Wartość „do ustalenia” w polach Od/Do harmonogramu. */
export const SCHEDULE_TIME_TBA = 'TBA'

export function isScheduleTimeTba(value?: string | null): boolean {
  return String(value ?? '').trim().toUpperCase() === SCHEDULE_TIME_TBA
}

/** Parsuje HH:mm; TBA i puste → null. */
export function parseScheduleTime(value?: string | null): { hours: number; minutes: number } | null {
  if (!value || isScheduleTimeTba(value)) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return { hours, minutes }
}
