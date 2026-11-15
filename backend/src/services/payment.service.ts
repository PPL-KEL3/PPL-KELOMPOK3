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
  paid_at: string | null
  created_at: string
  updated_at: string
}

const PAYMENT_COLUMNS = 'id, booking_id, customer_id, amount, payment_method, status, paid_at, created_at, updated_at'

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
  if (existing) return mapRow(existing)

  ensureConfigured()
  const { data, error } = await createSupabaseClient(accessToken)
    .from('payments')
    .insert({ booking_id: booking.id, customer_id: customerId, amount: booking.price, payment_method: 'qris', status: PAYMENT_STATUSES.UNPAID })
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
  return mapRow(data as PaymentRow)
}

export async function getPayment(bookingId: string, customerId: string, accessToken: string): Promise<PaymentDto> {
  const booking = await getBooking(bookingId, accessToken)
  if (booking.customerId !== customerId) throw new AppError(403, 'PAYMENT_OWNERSHIP_FORBIDDEN', 'Kamu tidak memiliki akses ke pembayaran ini.')
  const payment = await findByBooking(bookingId, accessToken)
  if (!payment) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Data pembayaran belum dibuat.')
  return mapRow(payment)
}

export async function markPaymentPaid(paymentId: string, accessToken: string): Promise<PaymentDto> {
  ensureConfigured()
  const { data: current, error: findError } = await createSupabaseClient(accessToken).from('payments').select(PAYMENT_COLUMNS).eq('id', paymentId).maybeSingle()
  if (findError) throw mapDatabaseError(findError)
  if (!current) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Data pembayaran tidak ditemukan.')
  const currentPayment = current as PaymentRow
  if (currentPayment.status === PAYMENT_STATUSES.PAID) return mapRow(currentPayment)

  const { data, error } = await createSupabaseClient(accessToken).from('payments').update({ status: PAYMENT_STATUSES.PAID, paid_at: new Date().toISOString() }).eq('id', paymentId).eq('status', PAYMENT_STATUSES.UNPAID).select(PAYMENT_COLUMNS).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new AppError(409, 'PAYMENT_UPDATE_CONFLICT', 'Status pembayaran berubah bersamaan.')
  return mapRow(data as PaymentRow)
}
