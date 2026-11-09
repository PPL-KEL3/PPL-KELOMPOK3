/**
 * Error that is safe to return to the client.
 * Internal details (Supabase responses, stack traces) must never be attached.
 */
export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}
