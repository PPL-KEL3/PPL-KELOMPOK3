import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AppError } from '../lib/errors'
import { normalizeDecisionNote, validateVerificationStatusTransition } from '../services/payment-verification.service'

function errorCode(action: () => void): string {
  try {
    action()
    return ''
  } catch (error) {
    return error instanceof AppError ? error.code : 'UNKNOWN'
  }
}

describe('TPR-111: validasi keputusan kasus pembayaran', () => {
  it('menerima transisi status yang diperbolehkan', () => {
    assert.doesNotThrow(() => validateVerificationStatusTransition('open', 'in_progress'))
    assert.doesNotThrow(() => validateVerificationStatusTransition('in_progress', 'resolved'))
    assert.doesNotThrow(() => validateVerificationStatusTransition('resolved', 'closed'))
    assert.doesNotThrow(() => validateVerificationStatusTransition('duplicate', 'closed'))
  })

  it('menolak transisi status yang tidak diperbolehkan', () => {
    assert.equal(errorCode(() => validateVerificationStatusTransition('closed', 'open')), 'INVALID_VERIFICATION_STATUS_TRANSITION')
    assert.equal(errorCode(() => validateVerificationStatusTransition('open', 'closed')), 'INVALID_VERIFICATION_STATUS_TRANSITION')
    assert.equal(errorCode(() => validateVerificationStatusTransition('duplicate', 'resolved')), 'INVALID_VERIFICATION_STATUS_TRANSITION')
  })

  it('menormalisasi catatan keputusan dan menolak catatan kosong', () => {
    assert.equal(normalizeDecisionNote('  Nominal tidak sesuai  '), 'Nominal tidak sesuai')
    assert.equal(errorCode(() => normalizeDecisionNote('   ')), 'VALIDATION_ERROR')
  })
})
