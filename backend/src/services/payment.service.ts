import { createSupabaseClient, supabaseConfigured } from '../config/supabase'
import { AppError } from '../lib/errors'
import { getBooking } from './booking.service'

export const PAYMENT_STATUSES = { UNPAID: 'unpaid', PAID: 'paid' } as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES]

export interface PaymentDto {
  id: string
  bookingId: string
  customerId: string
  amount: number
  paymentMethod: 'qris'
  status: PaymentStatus
  sessionStatus: 'active' | 'expired' | 'cancelled' | 'completed'
  expiresAt: string
  cancelledAt: string | null
  sessionVersion: number
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

interface PaymentRow {
  id: string
  booking_id: string
  customer_id: string
  amount: number
  payment_method: 'qris'
  status: PaymentStatus
  session_status: 'active' | 'expired' | 'cancelled' | 'completed'
  expires_at: string
  cancelled_at: string | null
  session_version: number
  paid_at: string | null
  created_at: string
  updated_at: string
}

const PAYMENT_COLUMNS = 'id, booking_id, customer_id, amount, payment_method, status, session_status, expires_at, cancelled_at, session_version, paid_at, created_at, updated_at'

function ensureConfigured() {
  if (!supabaseConfigured) throw new AppError(503, 'PAYMENT_SERVICE_UNAVAILABLE', 'Layanan pembayaran belum dikonfigurasi.')
}

function mapRow(row: PaymentRow): PaymentDto {
  return {
    id: row.id,
    bookingId: row.booking_id,
    customerId: row.customer_id,
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    status: row.status,
    sessionStatus: row.session_status,
    expiresAt: row.expires_at,
    cancelledAt: row.cancelled_at,
    sessionVersion: row.session_version,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDatabaseError(error: { code?: string; message?: string }) {
  if (error.code === '42P01' || error.code === 'PGRST205') return new AppError(503, 'PAYMENT_TABLE_UNAVAILABLE', 'Tabel pembayaran belum tersedia. Jalankan migration pembayaran terlebih dahulu.')
  if (error.code === '23505') return new AppError(409, 'PAYMENT_ALREADY_EXISTS', 'Sesi pembayaran untuk booking ini sudah tersedia.')
  if (error.code === '42501') return new AppError(403, 'PAYMENT_FORBIDDEN', 'Kamu tidak memiliki akses ke pembayaran ini.')
  console.error('[payment] Database error', { code: error.code ?? 'unknown' })
  return new AppError(502, 'PAYMENT_SERVICE_ERROR', 'Layanan pembayaran sedang bermasalah.')
}

async function findByBooking(bookingId: string, accessToken: string): Promise<PaymentRow | null> {
  ensureConfigured()
  const { data, error } = await createSupabaseClient(accessToken).from('payments').select(PAYMENT_COLUMNS).eq('booking_id', bookingId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  return data as PaymentRow | null
}

export async function getOrCreatePayment(bookingId: string, customerId: string, accessToken: string): Promise<PaymentDto> {
  const booking = await getBooking(bookingId, accessToken)
  if (booking.customerId !== customerId) throw new AppError(403, 'PAYMENT_OWNERSHIP_FORBIDDEN', 'Kamu tidak memiliki akses ke pembayaran ini.')
  if (booking.status !== 'accepted') throw new AppError(409, 'PAYMENT_NOT_ELIGIBLE', 'Booking belum memenuhi syarat untuk pembayaran.')

  const existing = await findByBooking(bookingId, accessToken)
  if (existing) return refreshPaymentRecord(existing, accessToken)

  ensureConfigured()
  const { data, error } = await createSupabaseClient(accessToken)
    .from('payments')
    .insert({ booking_id: booking.id, customer_id: customerId, amount: booking.price, payment_method: 'qris', status: PAYMENT_STATUSES.UNPAID, session_status: 'active', session_version: 1 })
    .select(PAYMENT_COLUMNS)
    .single()
  if (error) {
    if (error.code === '23505') {
      const concurrent = await findByBooking(bookingId, accessToken)
      if (concurrent) return mapRow(concurrent)
    }
    throw mapDatabaseError(error)
  }
  if (!data) throw new AppError(502, 'PAYMENT_CREATE_FAILED', 'Data pembayaran gagal disimpan.')
  const payment = mapRow(data as PaymentRow)
  await recordEvent(payment.id, payment.sessionVersion, 'created', accessToken)
  return payment
}

export async function getPayment(bookingId: string, customerId: string, accessToken: string): Promise<PaymentDto> {
  const booking = await getBooking(bookingId, accessToken)
  if (booking.customerId !== customerId) throw new AppError(403, 'PAYMENT_OWNERSHIP_FORBIDDEN', 'Kamu tidak memiliki akses ke pembayaran ini.')
  const payment = await findByBooking(bookingId, accessToken)
  if (!payment) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Data pembayaran belum dibuat.')
  return refreshPaymentRecord(payment, accessToken)
}

async function recordEvent(paymentId: string, sessionVersion: number, eventType: 'created' | 'expired' | 'regenerated' | 'cancelled' | 'completed', accessToken: string) {
  const { error } = await createSupabaseClient(accessToken).from('payment_session_events').insert({ payment_id: paymentId, session_version: sessionVersion, event_type: eventType })
  if (error) console.error('[payment] Session event could not be recorded', { code: error.code ?? 'unknown' })
}

async function updateSession(paymentId: string, input: Record<string, unknown>, accessToken: string): Promise<PaymentRow> {
  const { data, error } = await createSupabaseClient(accessToken).from('payments').update(input).eq('id', paymentId).eq('status', PAYMENT_STATUSES.UNPAID).select(PAYMENT_COLUMNS).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new AppError(409, 'PAYMENT_UPDATE_CONFLICT', 'Status pembayaran berubah bersamaan.')
  return data as PaymentRow
}

async function refreshPaymentRecord(payment: PaymentRow, accessToken: string): Promise<PaymentDto> {
  if (payment.status === PAYMENT_STATUSES.UNPAID && payment.session_status === 'active' && new Date(payment.expires_at).getTime() <= Date.now()) {
    const updated = await updateSession(payment.id, { session_status: 'expired' }, accessToken)
    await recordEvent(updated.id, updated.session_version, 'expired', accessToken)
    return mapRow(updated)
  }
  return mapRow(payment)
}

export async function regeneratePayment(bookingId: string, customerId: string, accessToken: string): Promise<PaymentDto> {
  const payment = await getPayment(bookingId, customerId, accessToken)
  if (payment.status === PAYMENT_STATUSES.PAID) throw new AppError(409, 'PAYMENT_ALREADY_PAID', 'Pembayaran yang sudah lunas tidak dapat dibuat ulang.')
  if (payment.sessionStatus === 'active') throw new AppError(409, 'PAYMENT_SESSION_ACTIVE', 'Sesi pembayaran masih aktif.')
  if (payment.sessionStatus !== 'expired') throw new AppError(409, 'PAYMENT_SESSION_NOT_REGENERABLE', 'Sesi ini tidak dapat dibuat ulang.')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const updated = await updateSession(payment.id, { session_status: 'active', expires_at: expiresAt, cancelled_at: null, session_version: payment.sessionVersion + 1 }, accessToken)
  await recordEvent(updated.id, updated.session_version, 'regenerated', accessToken)
  return mapRow(updated)
}

export async function cancelPayment(bookingId: string, customerId: string, accessToken: string): Promise<PaymentDto> {
  const payment = await getPayment(bookingId, customerId, accessToken)
  if (payment.status === PAYMENT_STATUSES.PAID || payment.sessionStatus === 'completed') throw new AppError(409, 'PAYMENT_ALREADY_PAID', 'Pembayaran yang sudah lunas tidak dapat dibatalkan.')
  if (payment.sessionStatus !== 'active') throw new AppError(409, 'PAYMENT_SESSION_NOT_CANCELLABLE', 'Sesi pembayaran ini sudah tidak aktif.')
  const updated = await updateSession(payment.id, { session_status: 'cancelled', cancelled_at: new Date().toISOString() }, accessToken)
  await recordEvent(updated.id, updated.session_version, 'cancelled', accessToken)
  return mapRow(updated)
}

export async function markPaymentPaid(paymentId: string, accessToken: string): Promise<PaymentDto> {
  ensureConfigured()
  const { data: current, error: findError } = await createSupabaseClient(accessToken).from('payments').select(PAYMENT_COLUMNS).eq('id', paymentId).maybeSingle()
  if (findError) throw mapDatabaseError(findError)
  if (!current) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Data pembayaran tidak ditemukan.')
  const currentPayment = current as PaymentRow
  if (currentPayment.status === PAYMENT_STATUSES.PAID) return mapRow(currentPayment)
  if (currentPayment.session_status !== 'active' || new Date(currentPayment.expires_at).getTime() <= Date.now()) throw new AppError(409, 'PAYMENT_SESSION_INACTIVE', 'Sesi pembayaran sudah tidak aktif.')

  const { data, error } = await createSupabaseClient(accessToken).from('payments').update({ status: PAYMENT_STATUSES.PAID, session_status: 'completed', paid_at: new Date().toISOString() }).eq('id', paymentId).eq('status', PAYMENT_STATUSES.UNPAID).select(PAYMENT_COLUMNS).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new AppError(409, 'PAYMENT_UPDATE_CONFLICT', 'Status pembayaran berubah bersamaan.')
  const payment = data as PaymentRow
  await recordEvent(payment.id, payment.session_version, 'completed', accessToken)
  return mapRow(payment)
}
