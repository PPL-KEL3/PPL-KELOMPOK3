export function normalizeWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, '')

  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`
  }

  if (digits.startsWith('8')) {
    return `62${digits}`
  }

  return digits
}

export function isValidWhatsAppNumber(value: string): boolean {
  return /^628[0-9]{7,12}$/.test(normalizeWhatsAppNumber(value))
}

export function formatWhatsAppDisplay(value: string): string {
  const normalized = normalizeWhatsAppNumber(value)

  if (!/^62[0-9]+$/.test(normalized)) {
    return value
  }

  const local = normalized.slice(2)

  if (local.length <= 4) return `+62 ${local}`
  if (local.length <= 8) return `+62 ${local.slice(0, 4)}-${local.slice(4)}`

  return `+62 ${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`
}

export function buildWhatsAppUrl(value: string, message?: string): string {
  const normalized = normalizeWhatsAppNumber(value)
  const base = `https://wa.me/${normalized}`

  if (!message?.trim()) return base

  return `${base}?text=${encodeURIComponent(message.trim())}`
}
