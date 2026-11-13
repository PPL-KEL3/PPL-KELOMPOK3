import assert from 'node:assert/strict'
import test from 'node:test'
import { hasValidImageSignature, isBookingRequirementsEditable } from '../services/booking-requirements.service'

test('TPR-79: menerima signature JPEG, PNG, dan WEBP yang sesuai MIME', () => {
  assert.equal(hasValidImageSignature('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0x00])), true)
  assert.equal(hasValidImageSignature('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true)
  assert.equal(hasValidImageSignature('image/webp', new TextEncoder().encode('RIFFxxxxWEBP')), true)
})

test('TPR-79: menolak signature yang tidak cocok dengan MIME', () => {
  assert.equal(hasValidImageSignature('image/png', new TextEncoder().encode('bukan gambar')), false)
  assert.equal(hasValidImageSignature('image/jpeg', new Uint8Array([0x89, 0x50, 0x4e, 0x47])), false)
  assert.equal(hasValidImageSignature('image/gif', new Uint8Array([0x47, 0x49, 0x46, 0x38])), false)
})

test('TPR-79: hanya booking pending yang dapat diubah', () => {
  assert.equal(isBookingRequirementsEditable('pending_provider_confirmation'), true)
  assert.equal(isBookingRequirementsEditable('accepted'), false)
  assert.equal(isBookingRequirementsEditable('cancelled'), false)
})
