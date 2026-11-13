import { createSupabaseClient, supabaseConfigured } from '../config/supabase'
import { AppError } from '../lib/errors'
import type { DatabaseErrorLike } from './category.service'
import { assertPendingBookingStatus, validateBookingSchedule, type ProviderOperatingHours } from './booking-validation.service'

export const BOOKING_STATUSES = {
  PENDING_PROVIDER_CONFIRMATION: 'pending_provider_confirmation',
  ACCEPTED: 'accepted',
  CANCELLED: 'cancelled',
} as const

export type BookingStatus = (typeof BOOKING_STATUSES)[keyof typeof BOOKING_STATUSES]

export interface BookingDto {
  id: string
  customerId: string
  providerId: string
  serviceId: string
  packageId: string | null
  serviceName: string
  providerName: string
  customerName?: string
  packageName: string | null
  workDate: string
  workTime: string
  price: number
  status: BookingStatus
  cancellationReason: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateBookingInput {
  serviceId: string
  packageId?: string | null
  workDate: string
  workTime: string
  idempotencyKey?: string
}

export interface UpdateBookingInput {
  packageId?: string | null
  workDate?: string
  workTime?: string
}

interface BookingRow {
  id: string
  customer_id: string
  provider_id: string
  service_id: string
  package_id: string | null
  work_date: string
  work_time: string
  price: number
  status: BookingStatus
  cancellation_reason: string | null
  created_at: string
  updated_at: string
  services?: { name?: string; provider_id?: string } | Array<{ name?: string }>
  service_packages?: { name?: string } | Array<{ name?: string }> | null
  customer?: { full_name?: string; email?: string } | Array<{ full_name?: string; email?: string }>
  provider?: { full_name?: string } | Array<{ full_name?: string }>
}

interface ServiceContext { id: string; provider_id: string; name: string; price: number; is_active: boolean }
interface PackageContext { id: string; service_id: string; name: string; price: number; is_active: boolean; deleted_at: string | null }

export interface BookingStore {
  findService(id: string, accessToken: string): Promise<{ data: ServiceContext | null; error: DatabaseErrorLike | null }>
  findPackage(id: string, serviceId: string, accessToken: string): Promise<{ data: PackageContext | null; error: DatabaseErrorLike | null }>
  findProviderOperatingHours(providerId: string, accessToken: string): Promise<{ data: ProviderOperatingHours | null; error: DatabaseErrorLike | null }>
  insert(input: Record<string, unknown>, accessToken: string): Promise<{ data: BookingRow | null; error: DatabaseErrorLike | null }>
  findByCustomer(customerId: string, accessToken: string): Promise<{ data: BookingRow[] | null; error: DatabaseErrorLike | null }>
  findByProvider(providerId: string, accessToken: string): Promise<{ data: BookingRow[] | null; error: DatabaseErrorLike | null }>
  findById(id: string, accessToken: string): Promise<{ data: BookingRow | null; error: DatabaseErrorLike | null }>
  update(id: string, input: Record<string, unknown>, accessToken: string, expectedStatus?: BookingStatus): Promise<{ data: BookingRow | null; error: DatabaseErrorLike | null }>
}

const BOOKING_COLUMNS = `id, customer_id, provider_id, service_id, package_id, work_date, work_time, price, status, cancellation_reason, created_at, updated_at, services(name), service_packages(name), customer:profiles!bookings_customer_id_fkey(full_name, email), provider:profiles!bookings_provider_id_fkey(full_name)`

function ensureConfigured() {
  if (!supabaseConfigured) throw new AppError(503, 'BOOKING_SERVICE_UNAVAILABLE', 'Layanan booking belum dikonfigurasi. Hubungi administrator LOKA.')
}

const supabaseBookingStore: BookingStore = {
  async findService(id, accessToken) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(accessToken).from('services').select('id, provider_id, name, price, is_active').eq('id', id).maybeSingle()
    return { data: data as ServiceContext | null, error }
  },
  async findPackage(id, serviceId, accessToken) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(accessToken).from('service_packages').select('id, service_id, name, price, is_active, deleted_at').eq('id', id).eq('service_id', serviceId).maybeSingle()
    return { data: data as PackageContext | null, error }
  },
  async findProviderOperatingHours(providerId, accessToken) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(accessToken).from('provider_profiles').select('operating_hours').eq('profile_id', providerId).maybeSingle()
    return { data: (data?.operating_hours as ProviderOperatingHours | null) ?? null, error }
  },
  async insert(input, accessToken) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(accessToken).from('bookings').insert(input).select(BOOKING_COLUMNS).single()
    return { data: data as BookingRow | null, error }
  },
  async findByCustomer(customerId, accessToken) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(accessToken).from('bookings').select(BOOKING_COLUMNS).eq('customer_id', customerId).order('created_at', { ascending: false })
    return { data: data as BookingRow[] | null, error }
  },
  async findByProvider(providerId, accessToken) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(accessToken).from('bookings').select(BOOKING_COLUMNS).eq('provider_id', providerId).order('created_at', { ascending: false })
    return { data: data as BookingRow[] | null, error }
  },
  async findById(id, accessToken) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(accessToken).from('bookings').select(BOOKING_COLUMNS).eq('id', id).maybeSingle()
    return { data: data as BookingRow | null, error }
  },
  async update(id, input, accessToken, expectedStatus) {
    ensureConfigured()
    let query = createSupabaseClient(accessToken).from('bookings').update(input).eq('id', id)
    if (expectedStatus) query = query.eq('status', expectedStatus)
    const { data, error } = await query.select(BOOKING_COLUMNS).maybeSingle()
    return { data: data as BookingRow | null, error }
  },
}

let activeBookingStore: BookingStore = supabaseBookingStore
export function setBookingStoreForTesting(store: BookingStore | null) { activeBookingStore = store ?? supabaseBookingStore }

function mapDbError(action: string, error: DatabaseErrorLike): AppError {
  const code = error.code ?? ''
  if (code === '23503') return new AppError(400, 'INVALID_BOOKING_REFERENCE', 'Jasa atau paket booking tidak ditemukan.')
  if (code === '23505') {
    const text = `${error.message ?? ''} ${error.details ?? ''}`
    if (text.includes('bookings_customer_idempotency_uidx')) {
      return new AppError(409, 'BOOKING_DUPLICATE', 'Permintaan booking yang sama sudah diproses.')
    }
    return new AppError(409, 'BOOKING_SLOT_UNAVAILABLE', 'Jadwal yang kamu pilih sudah tidak tersedia. Silakan pilih waktu lain.')
  }
  if (code === '23514') return new AppError(400, 'VALIDATION_ERROR', 'Data booking tidak valid.')
  if (code === '22P02') return new AppError(400, 'INVALID_BOOKING_ID', 'Format ID booking tidak valid.')
  if (code === '42501') return new AppError(403, 'BOOKING_OWNERSHIP_FORBIDDEN', 'Kamu tidak memiliki akses ke booking ini.')
  if (code === '42P01' || code === 'PGRST205') return new AppError(503, 'BOOKING_TABLE_UNAVAILABLE', 'Tabel booking belum tersedia pada database.')
  console.error('[booking] Database error', { action, code: code || 'unknown' })
  return new AppError(502, 'BOOKING_SERVICE_ERROR', 'Layanan booking sedang bermasalah. Silakan coba lagi.')
}

function nestedName(value: unknown): string | null {
  const item = Array.isArray(value) ? value[0] : value
  if (!item || typeof item !== 'object') return null
  const record = item as { name?: unknown; full_name?: unknown }
  return typeof record.name === 'string'
    ? record.name
    : typeof record.full_name === 'string'
      ? record.full_name
      : null
}

function mapRow(row: BookingRow): BookingDto {
  return {
    id: row.id, customerId: row.customer_id, providerId: row.provider_id, serviceId: row.service_id,
    packageId: row.package_id, serviceName: nestedName(row.services) ?? 'Jasa LOKA', providerName: nestedName(row.provider) ?? 'Penyedia Jasa LOKA',
    customerName: nestedName(row.customer) ?? undefined, packageName: nestedName(row.service_packages), workDate: row.work_date, workTime: row.work_time,
    price: Number(row.price), status: row.status, cancellationReason: row.cancellation_reason, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

async function loadBooking(id: string, accessToken: string): Promise<BookingRow> {
  const result = await activeBookingStore.findById(id, accessToken)
  if (result.error) throw mapDbError('find', result.error)
  if (!result.data) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking tidak ditemukan.')
  return result.data
}

export async function createBooking(input: CreateBookingInput, customerId: string, accessToken: string): Promise<BookingDto> {
  const serviceResult = await activeBookingStore.findService(input.serviceId, accessToken)
  if (serviceResult.error) throw mapDbError('find_service', serviceResult.error)
  const service = serviceResult.data
  if (!service || !service.is_active) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Jasa tidak ditemukan atau sudah tidak aktif.')
  const scheduleResult = await activeBookingStore.findProviderOperatingHours(service.provider_id, accessToken)
  if (scheduleResult.error) throw mapDbError('find_provider_schedule', scheduleResult.error)
  if (!scheduleResult.data) throw new AppError(409, 'PROVIDER_SCHEDULE_UNAVAILABLE', 'Jadwal operasional penyedia belum tersedia.')
  validateBookingSchedule(input.workDate, input.workTime, scheduleResult.data)

  let price = Number(service.price)
  if (input.packageId) {
    const packageResult = await activeBookingStore.findPackage(input.packageId, input.serviceId, accessToken)
    if (packageResult.error) throw mapDbError('find_package', packageResult.error)
    const pkg = packageResult.data
    if (!pkg || !pkg.is_active || pkg.deleted_at) throw new AppError(404, 'PACKAGE_NOT_FOUND', 'Paket tidak ditemukan atau sudah tidak aktif.')
    price = Number(pkg.price)
  }

  const result = await activeBookingStore.insert({ customer_id: customerId, provider_id: service.provider_id, service_id: input.serviceId, package_id: input.packageId ?? null, work_date: input.workDate, work_time: input.workTime.trim(), idempotency_key: input.idempotencyKey ?? null, price, status: BOOKING_STATUSES.PENDING_PROVIDER_CONFIRMATION }, accessToken)
  if (result.error) throw mapDbError('create', result.error)
  if (!result.data) throw new AppError(502, 'BOOKING_CREATE_FAILED', 'Booking gagal disimpan. Silakan coba lagi.')
  return mapRow(result.data)
}

export async function listCustomerBookings(customerId: string, accessToken: string) {
  const result = await activeBookingStore.findByCustomer(customerId, accessToken)
  if (result.error) throw mapDbError('list_customer', result.error)
  return (result.data ?? []).map(mapRow)
}

export async function listProviderBookings(providerId: string, accessToken: string) {
  const result = await activeBookingStore.findByProvider(providerId, accessToken)
  if (result.error) throw mapDbError('list_provider', result.error)
  return (result.data ?? []).map(mapRow)
}

export async function getBooking(id: string, accessToken: string) { return mapRow(await loadBooking(id, accessToken)) }

export async function updateCustomerBooking(id: string, input: UpdateBookingInput, customerId: string, accessToken: string) {
  const existing = await loadBooking(id, accessToken)
  if (existing.customer_id !== customerId) throw new AppError(403, 'BOOKING_OWNERSHIP_FORBIDDEN', 'Kamu tidak memiliki akses ke booking ini.')
  if (existing.status !== BOOKING_STATUSES.PENDING_PROVIDER_CONFIRMATION) throw new AppError(409, 'BOOKING_LOCKED', 'Booking tidak dapat diubah setelah diproses penyedia.')
  const scheduleResult = await activeBookingStore.findProviderOperatingHours(existing.provider_id, accessToken)
  if (scheduleResult.error) throw mapDbError('find_provider_schedule_update', scheduleResult.error)
  if (!scheduleResult.data) throw new AppError(409, 'PROVIDER_SCHEDULE_UNAVAILABLE', 'Jadwal operasional penyedia belum tersedia.')
  validateBookingSchedule(input.workDate ?? existing.work_date, input.workTime ?? existing.work_time, scheduleResult.data)
  const payload: Record<string, unknown> = {}
  if (input.workDate !== undefined) payload.work_date = input.workDate
  if (input.workTime !== undefined) payload.work_time = input.workTime.trim()
  if (input.packageId !== undefined) {
    if (input.packageId === null) {
      const service = await activeBookingStore.findService(existing.service_id, accessToken)
      if (service.error) throw mapDbError('find_service_update', service.error)
      if (!service.data) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Jasa tidak ditemukan.')
      payload.package_id = null
      payload.price = Number(service.data.price)
    }
    else {
      const pkg = await activeBookingStore.findPackage(input.packageId, existing.service_id, accessToken)
      if (pkg.error) throw mapDbError('find_package_update', pkg.error)
      if (!pkg.data || !pkg.data.is_active || pkg.data.deleted_at) throw new AppError(404, 'PACKAGE_NOT_FOUND', 'Paket tidak ditemukan atau sudah tidak aktif.')
      payload.package_id = input.packageId
      payload.price = Number(pkg.data.price)
    }
  }
  if (!Object.keys(payload).length) throw new AppError(400, 'VALIDATION_ERROR', 'Minimal satu data booking harus diubah.')
  const result = await activeBookingStore.update(id, payload, accessToken, BOOKING_STATUSES.PENDING_PROVIDER_CONFIRMATION)
  if (result.error) throw mapDbError('update', result.error)
  if (!result.data) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking tidak ditemukan.')
  return mapRow(result.data)
}

async function transition(id: string, accessToken: string, actorId: string, target: BookingStatus, actor: 'customer' | 'provider', reason?: string) {
  const existing = await loadBooking(id, accessToken)
  if (actor === 'customer' && existing.customer_id !== actorId) throw new AppError(403, 'BOOKING_OWNERSHIP_FORBIDDEN', 'Kamu tidak memiliki akses ke booking ini.')
  if (actor === 'provider' && existing.provider_id !== actorId) throw new AppError(403, 'BOOKING_OWNERSHIP_FORBIDDEN', 'Booking ini bukan milik layananmu.')
  assertPendingBookingStatus(existing.status)
  const result = await activeBookingStore.update(id, { status: target, ...(reason ? { cancellation_reason: reason } : {}) }, accessToken, BOOKING_STATUSES.PENDING_PROVIDER_CONFIRMATION)
  if (result.error) throw mapDbError('transition', result.error)
  if (!result.data) throw new AppError(409, 'BOOKING_UPDATE_CONFLICT', 'Booking berubah bersamaan. Muat ulang dan coba lagi.')
  return mapRow(result.data)
}

export function acceptBooking(id: string, providerId: string, token: string) { return transition(id, token, providerId, BOOKING_STATUSES.ACCEPTED, 'provider') }
export function rejectBooking(id: string, providerId: string, token: string, reason?: string) { return transition(id, token, providerId, BOOKING_STATUSES.CANCELLED, 'provider', reason) }
export function cancelBooking(id: string, customerId: string, token: string) { return transition(id, token, customerId, BOOKING_STATUSES.CANCELLED, 'customer', 'Dibatalkan oleh pelanggan.') }
