import {
  DAY_KEYS,
  DAY_LABELS,
  type DayKey,
  type DaySchedule,
  type OperatingHours,
} from '@/types/provider'

export const DEFAULT_OPERATING_HOURS: OperatingHours = {
  monday: { isOpen: true, open: '08:00', close: '17:00' },
  tuesday: { isOpen: true, open: '08:00', close: '17:00' },
  wednesday: { isOpen: true, open: '08:00', close: '17:00' },
  thursday: { isOpen: true, open: '08:00', close: '17:00' },
  friday: { isOpen: true, open: '08:00', close: '17:00' },
  saturday: { isOpen: true, open: '08:00', close: '12:00' },
  sunday: { isOpen: false },
}

export function cloneOperatingHours(hours: OperatingHours): OperatingHours {
  return DAY_KEYS.reduce((result, day) => {
    const schedule = hours[day]
    result[day] = schedule.isOpen
      ? { isOpen: true, open: schedule.open ?? '', close: schedule.close ?? '' }
      : { isOpen: false }
    return result
  }, {} as OperatingHours)
}

export function normalizeOperatingHours(raw: unknown): OperatingHours {
  const source =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  return DAY_KEYS.reduce((result, day) => {
    const value = source[day]
    const schedule =
      value && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {}

    if (schedule.isOpen === true) {
      result[day] = {
        isOpen: true,
        open: typeof schedule.open === 'string' ? schedule.open : '',
        close: typeof schedule.close === 'string' ? schedule.close : '',
      }
    } else {
      result[day] = { isOpen: false }
    }

    return result
  }, {} as OperatingHours)
}

function isValidTime(value: string | undefined): value is string {
  return typeof value === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function validateOperatingHours(hours: OperatingHours): string | null {
  let openDayCount = 0

  for (const day of DAY_KEYS) {
    const schedule = hours[day]

    if (!schedule || typeof schedule.isOpen !== 'boolean') {
      return 'Jam operasional wajib diisi untuk setiap hari.'
    }

    if (!schedule.isOpen) continue

    if (!isValidTime(schedule.open)) {
      return `Format jam buka hari ${DAY_LABELS[day]} harus HH:mm.`
    }

    if (!isValidTime(schedule.close)) {
      return `Format jam tutup hari ${DAY_LABELS[day]} harus HH:mm.`
    }

    if (timeToMinutes(schedule.open) >= timeToMinutes(schedule.close)) {
      return `Jam tutup hari ${DAY_LABELS[day]} harus lebih lambat dari jam buka.`
    }

    openDayCount += 1
  }

  if (openDayCount === 0) {
    return 'Minimal satu hari harus dibuka.'
  }

  return null
}

function formatTime(value: string | undefined): string {
  return value ? value.replace(':', '.') : '-'
}

export function formatDaySchedule(schedule: DaySchedule): string {
  if (!schedule.isOpen) return 'Tutup'
  return `${formatTime(schedule.open)}–${formatTime(schedule.close)}`
}

export function formatOperatingHours(
  hours: OperatingHours
): Array<{ day: DayKey; label: string; text: string }> {
  return DAY_KEYS.map((day) => ({
    day,
    label: DAY_LABELS[day],
    text: formatDaySchedule(hours[day]),
  }))
}
