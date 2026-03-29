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
