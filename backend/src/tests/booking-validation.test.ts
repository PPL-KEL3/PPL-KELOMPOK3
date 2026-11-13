import assert from 'node:assert/strict'
import test from 'node:test'
import { AppError } from '../lib/errors'
import { assertPendingBookingStatus, validateBookingSchedule, type ProviderOperatingHours } from '../services/booking-validation.service'

const HOURS: ProviderOperatingHours = {
  sunday: { isOpen: false },
  monday: { isOpen: true, open: '08:00', close: '17:00' },
  tuesday: { isOpen: true, open: '08:00', close: '17:00' },
  wednesday: { isOpen: true, open: '08:00', close: '17:00' },
  thursday: { isOpen: true, open: '08:00', close: '17:00' },
  friday: { isOpen: true, open: '08:00', close: '17:00' },
  saturday: { isOpen: false },
}

function codeOf(action: () => void): string {
  try {
    action()
  } catch (error) {
    assert.ok(error instanceof AppError)
    return error.code
  }
  return ''
}

test('TPR-75: menerima slot di dalam jam operasional', () => {
  assert.doesNotThrow(() => validateBookingSchedule('2099-01-05', '08.00–09.00', HOURS))
})

test('TPR-75: menolak tanggal lampau dan hari tutup', () => {
  assert.equal(codeOf(() => validateBookingSchedule('2000-01-03', '08.00–09.00', HOURS)), 'BOOKING_DATE_IN_PAST')
  assert.equal(codeOf(() => validateBookingSchedule('2099-01-04', '08.00–09.00', HOURS)), 'BOOKING_DAY_UNAVAILABLE')
})

test('TPR-75: menolak slot di luar jam operasional atau format invalid', () => {
  assert.equal(codeOf(() => validateBookingSchedule('2099-01-05', '07.00–08.00', HOURS)), 'BOOKING_SLOT_UNAVAILABLE')
  assert.equal(codeOf(() => validateBookingSchedule('2099-01-05', 'pagi', HOURS)), 'BOOKING_SLOT_INVALID')
})

test('TPR-75: hanya status pending yang dapat diproses', () => {
  assert.doesNotThrow(() => assertPendingBookingStatus('pending_provider_confirmation'))
  assert.equal(codeOf(() => assertPendingBookingStatus('accepted')), 'INVALID_BOOKING_STATUS')
  assert.equal(codeOf(() => assertPendingBookingStatus('cancelled')), 'INVALID_BOOKING_STATUS')
})
