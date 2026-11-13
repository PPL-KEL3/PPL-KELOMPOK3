import { AppError } from '../lib/errors'

export interface ProviderOperatingHours {
  [day: string]: {
    isOpen?: boolean
    open?: string
    close?: string
  } | undefined
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const TIME_PATTERN = /^(\d{2})[:.](\d{2})\s*[–-]\s*(\d{2})[:.](\d{2})$/

function minutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

function normalizeTimeRange(value: string): { start: number; end: number } | null {
  const match = TIME_PATTERN.exec(value.trim())
  if (!match) return null
  const start = minutes(`${match[1]}:${match[2]}`)
  const end = minutes(`${match[3]}:${match[4]}`)
  if (start === null || end === null || end <= start) return null
  return { start, end }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function validateBookingSchedule(
  workDate: string,
  workTime: string,
  operatingHours: ProviderOperatingHours | null | undefined
): void {
  if (!validCalendarDate(workDate)) {
    throw new AppError(400, 'BOOKING_DATE_INVALID', 'Tanggal pengerjaan tidak valid.', { workDate: 'Gunakan tanggal yang valid.' })
  }
  if (workDate < todayUtc()) {
    throw new AppError(400, 'BOOKING_DATE_IN_PAST', 'Tanggal pengerjaan tidak boleh berada di masa lalu.', { workDate: 'Pilih tanggal hari ini atau setelahnya.' })
  }

  const date = new Date(`${workDate}T00:00:00.000Z`)
  const day = DAY_KEYS[date.getUTCDay()]
  const schedule = operatingHours?.[day]
  if (!schedule?.isOpen || !schedule.open || !schedule.close) {
    throw new AppError(409, 'BOOKING_DAY_UNAVAILABLE', 'Penyedia jasa tidak beroperasi pada tanggal tersebut.', { workDate: 'Pilih hari operasional penyedia jasa.' })
  }

  const requested = normalizeTimeRange(workTime)
  const opening = minutes(schedule.open)
  const closing = minutes(schedule.close)
  if (!requested || opening === null || closing === null || closing <= opening) {
    throw new AppError(400, 'BOOKING_SLOT_INVALID', 'Format waktu pengerjaan tidak valid.', { workTime: 'Gunakan format slot seperti 08.00–09.00.' })
  }
  if (requested.start < opening || requested.end > closing) {
    throw new AppError(409, 'BOOKING_SLOT_UNAVAILABLE', 'Jadwal yang kamu pilih berada di luar jam operasional penyedia.', { workTime: 'Pilih slot pada jam operasional penyedia.' })
  }
}

export function assertPendingBookingStatus(status: string): void {
  if (status !== 'pending_provider_confirmation') {
    throw new AppError(409, 'INVALID_BOOKING_STATUS', 'Status booking saat ini tidak memungkinkan aksi tersebut.')
  }
}
