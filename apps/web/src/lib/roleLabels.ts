const BUILTIN_ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  OPERATOR_FULL: 'Operator (pełny)',
}

export function formatRoleLabel(role: string | undefined | null): string {
  if (!role) return 'Brak roli'
  return BUILTIN_ROLE_LABELS[role] ?? role
}
