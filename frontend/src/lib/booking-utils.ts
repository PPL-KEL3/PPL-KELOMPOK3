import { DAY_KEYS, type DayKey, type OperatingHours } from '@/types/provider'

const JS_DAY_TO_KEY: DayKey[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

export function todayInputValue(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function formatBookingDate(value: string): string {
  if (!value) return 'Belum dipilih'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function dayKeyForDate(value: string): DayKey | null {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : JS_DAY_TO_KEY[date.getDay()]
}

export function getWorkHours(
  value: string,
  hours: OperatingHours
): { open: string; close: string } | null {
  const dayKey = dayKeyForDate(value)
  if (!dayKey || !DAY_KEYS.includes(dayKey)) return null
  const schedule = hours[dayKey]
  if (!schedule?.isOpen || !schedule.open || !schedule.close) return null
  return { open: schedule.open, close: schedule.close }
}

/**
 * Availability endpoint belum ada di repository. Fungsi ini hanya memetakan
 * jam operasional yang benar-benar tersimpan menjadi slot tampilan 60 menit;
 * backend TPR-74 tetap harus menjadi sumber kebenaran slot/fuller nantinya.
 */
export function deriveHourlySlots(
  value: string,
  hours: OperatingHours
): string[] {
  const schedule = getWorkHours(value, hours)
  if (!schedule) return []
  const [openHour, openMinute] = schedule.open.split(':').map(Number)
  const [closeHour, closeMinute] = schedule.close.split(':').map(Number)
  let cursor = openHour * 60 + openMinute
  const end = closeHour * 60 + closeMinute
  const slots: string[] = []
  while (cursor + 60 <= end) {
    const next = cursor + 60
    const display = (minutes: number) =>
      `${String(Math.floor(minutes / 60)).padStart(2, '0')}.${String(minutes % 60).padStart(2, '0')}`
    slots.push(`${display(cursor)}–${display(next)}`)
    cursor = next
  }
  return slots
}
