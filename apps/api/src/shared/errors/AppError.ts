export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} nie znaleziono`, 404, 'NOT_FOUND')
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super('Błąd walidacji', 400, 'VALIDATION_ERROR', details)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT')
  }
}

/** Rezerwacja sprzętu koliduje z innym zleceniem — obsługiwane w orders.controller (409). */
export class EquipmentUnavailableError extends Error {
  readonly code = 'EQUIPMENT_UNAVAILABLE' as const

  constructor(
    message: string,
    public readonly details: unknown
  ) {
    super(message)
    this.name = 'EquipmentUnavailableError'
  }
}
