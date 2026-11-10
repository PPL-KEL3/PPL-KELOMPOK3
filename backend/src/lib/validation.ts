const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function asBoolean(value: unknown): boolean {
  return value === true || value === 'true'
}

export function normalizeEmail(value: unknown): string {
  return asString(value).trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return email.length > 0 && email.length <= 254 && EMAIL_PATTERN.test(email)
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 128
}

export function isValidFullName(name: string): boolean {
  return name.trim().length >= 2 && name.trim().length <= 80
}

export function validateEmailField(email: string): string | null {
  if (!email) return 'Email wajib diisi.'
  if (!isValidEmail(email)) return 'Masukkan alamat email yang valid.'
  return null
}

export function validatePasswordField(password: string): string | null {
  if (!password) return 'Password wajib diisi.'
  if (!isValidPassword(password)) return 'Password minimal 8 karakter.'
  return null
}
