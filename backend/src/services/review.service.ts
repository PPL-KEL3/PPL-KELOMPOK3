import { createSupabaseClient, supabaseConfigured } from '../config/supabase'
import { AppError } from '../lib/errors'

export const MAX_REVIEW_EDITS = 3
export const MIN_COMMENT_LENGTH = 10
export const MAX_COMMENT_LENGTH = 1000

export interface ReviewDto {
  id: string
  bookingId: string
  customerId: string
  customerName: string
  providerId: string
  serviceId: string
  serviceName: string
  rating: number
  comment: string
  editCount: number
  isEdited: boolean
  createdAt: string
  updatedAt: string
}

export interface ProviderReviewStats {
  averageRating: number
  totalReviews: number
  ratingDistribution: {
    1: number
    2: number
    3: number
    4: number
    5: number
  }
}

export interface ReviewRow {
  id: string
  booking_id: string
  customer_id: string
  provider_id: string
  service_id: string
  rating: number
  comment: string
  edit_count: number
  is_edited: boolean
  created_at: string
  updated_at: string
  customer?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null
  services?: { name?: string | null } | Array<{ name?: string | null }> | null
}

export interface BookingReferenceRow {
  id: string
  customer_id: string
  provider_id: string
  service_id: string
  status: string
}

export interface CreateReviewInput {
  bookingId: string
  rating: number
  comment: string
}

export interface UpdateReviewInput {
  rating?: number
  comment?: string
}

export interface DatabaseErrorLike {
  code?: string
  message?: string
  details?: string | null
}

export interface ReviewStore {
  findBookingById(bookingId: string, accessToken?: string): Promise<{
    data: BookingReferenceRow | null
    error: DatabaseErrorLike | null
  }>

  findReviewByBookingId(bookingId: string, accessToken?: string): Promise<{
    data: ReviewRow | null
    error: DatabaseErrorLike | null
  }>

  findReviewById(id: string, accessToken?: string): Promise<{
    data: ReviewRow | null
    error: DatabaseErrorLike | null
  }>

  findByProvider(providerId: string, accessToken?: string): Promise<{
    data: ReviewRow[] | null
    error: DatabaseErrorLike | null
  }>

  findByCustomer(customerId: string, accessToken?: string): Promise<{
    data: ReviewRow[] | null
    error: DatabaseErrorLike | null
  }>

  insert(
    payload: {
      booking_id: string
      customer_id: string
      provider_id: string
      service_id: string
      rating: number
      comment: string
    },
    accessToken?: string
  ): Promise<{ data: ReviewRow | null; error: DatabaseErrorLike | null }>

  update(
    id: string,
    payload: {
      rating?: number
      comment?: string
      edit_count: number
      is_edited: boolean
    },
    accessToken?: string
  ): Promise<{ data: ReviewRow | null; error: DatabaseErrorLike | null }>

  delete(id: string, accessToken?: string): Promise<{
    data: ReviewRow | null
    error: DatabaseErrorLike | null
  }>
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateUuid(val: unknown, fieldName: string): string {
  if (typeof val !== 'string' || !UUID_REGEX.test(val.trim())) {
    throw new AppError(400, 'VALIDATION_ERROR', `Format ${fieldName} tidak valid.`, {
      [fieldName]: `Format ${fieldName} tidak valid.`,
    })
  }
  return val.trim()
}

export function validateCreateReviewInput(raw: unknown): CreateReviewInput {
  if (typeof raw !== 'object' || raw === null) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Payload permintaan tidak valid.')
  }

  const body = raw as Record<string, unknown>
  const errors: Record<string, string> = {}

  if (!body.bookingId || typeof body.bookingId !== 'string' || !UUID_REGEX.test(body.bookingId.trim())) {
    errors.bookingId = 'ID booking wajib diisi dengan format UUID yang valid.'
  }

  const ratingNum = Number(body.rating)
  if (
    body.rating === undefined ||
    body.rating === null ||
    Number.isNaN(ratingNum) ||
    !Number.isInteger(ratingNum) ||
    ratingNum < 1 ||
    ratingNum > 5
  ) {
    errors.rating = 'Rating wajib berupa bilangan bulat antara 1 dan 5.'
  }

  if (typeof body.comment !== 'string') {
    errors.comment = 'Komentar ulasan wajib berupa teks.'
  } else {
    const trimmed = body.comment.trim()
    if (trimmed.length < MIN_COMMENT_LENGTH) {
      errors.comment = `Komentar ulasan minimal ${MIN_COMMENT_LENGTH} karakter.`
    } else if (trimmed.length > MAX_COMMENT_LENGTH) {
      errors.comment = `Komentar ulasan maksimal ${MAX_COMMENT_LENGTH} karakter.`
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Data ulasan tidak valid.', errors)
  }

  return {
    bookingId: (body.bookingId as string).trim(),
    rating: ratingNum,
    comment: (body.comment as string).trim(),
  }
}

export function validateUpdateReviewInput(raw: unknown): UpdateReviewInput {
  if (typeof raw !== 'object' || raw === null) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Payload permintaan tidak valid.')
  }

  const body = raw as Record<string, unknown>
  const errors: Record<string, string> = {}

  if (body.rating === undefined && body.comment === undefined) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Minimal rating atau komentar harus disertakan untuk perubahan.')
  }

  let ratingNum: number | undefined = undefined
  if (body.rating !== undefined) {
    ratingNum = Number(body.rating)
    if (
      Number.isNaN(ratingNum) ||
      !Number.isInteger(ratingNum) ||
      ratingNum < 1 ||
      ratingNum > 5
    ) {
      errors.rating = 'Rating wajib berupa bilangan bulat antara 1 dan 5.'
    }
  }

  let trimmedComment: string | undefined = undefined
  if (body.comment !== undefined) {
    if (typeof body.comment !== 'string') {
      errors.comment = 'Komentar ulasan wajib berupa teks.'
    } else {
      trimmedComment = body.comment.trim()
      if (trimmedComment.length < MIN_COMMENT_LENGTH) {
        errors.comment = `Komentar ulasan minimal ${MIN_COMMENT_LENGTH} karakter.`
      } else if (trimmedComment.length > MAX_COMMENT_LENGTH) {
        errors.comment = `Komentar ulasan maksimal ${MAX_COMMENT_LENGTH} karakter.`
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Perubahan ulasan tidak valid.', errors)
  }

  return {
    ...(ratingNum !== undefined ? { rating: ratingNum } : {}),
    ...(trimmedComment !== undefined ? { comment: trimmedComment } : {}),
  }
}

export function mapReviewRowToDto(row: ReviewRow): ReviewDto {
  let customerName = 'Pelanggan LOKA'
  if (Array.isArray(row.customer)) {
    customerName = row.customer[0]?.full_name || customerName
  } else if (row.customer?.full_name) {
    customerName = row.customer.full_name
  }

  let serviceName = 'Layanan Jasa'
  if (Array.isArray(row.services)) {
    serviceName = row.services[0]?.name || serviceName
  } else if (row.services?.name) {
    serviceName = row.services.name
  }

  return {
    id: row.id,
    bookingId: row.booking_id,
    customerId: row.customer_id,
    customerName,
    providerId: row.provider_id,
    serviceId: row.service_id,
    serviceName,
    rating: row.rating,
    comment: row.comment,
    editCount: row.edit_count,
    isEdited: row.is_edited,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function calculateReviewStats(reviews: ReviewDto[]): ProviderReviewStats {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  if (reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: distribution,
    }
  }

  let sum = 0
  for (const r of reviews) {
    const star = Math.max(1, Math.min(5, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5
    distribution[star] = (distribution[star] || 0) + 1
    sum += r.rating
  }

  const averageRating = Math.round((sum / reviews.length) * 10) / 10

  return {
    averageRating,
    totalReviews: reviews.length,
    ratingDistribution: distribution,
  }
}

const REVIEW_SELECT_COLUMNS = `
  id,
  booking_id,
  customer_id,
  provider_id,
  service_id,
  rating,
  comment,
  edit_count,
  is_edited,
  created_at,
  updated_at,
  customer:profiles!reviews_customer_id_fkey ( full_name ),
  services!reviews_service_id_fkey ( name )
`

export class SupabaseReviewStore implements ReviewStore {
  async findBookingById(bookingId: string, accessToken?: string) {
    if (!supabaseConfigured) return { data: null, error: null }
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('bookings')
      .select('id, customer_id, provider_id, service_id, status')
      .eq('id', bookingId)
      .maybeSingle()
    return { data: (data as unknown as BookingReferenceRow) ?? null, error }
  }

  async findReviewByBookingId(bookingId: string, accessToken?: string) {
    if (!supabaseConfigured) return { data: null, error: null }
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('reviews')
      .select(REVIEW_SELECT_COLUMNS)
      .eq('booking_id', bookingId)
      .maybeSingle()
    return { data: (data as unknown as ReviewRow) ?? null, error }
  }

  async findReviewById(id: string, accessToken?: string) {
    if (!supabaseConfigured) return { data: null, error: null }
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('reviews')
      .select(REVIEW_SELECT_COLUMNS)
      .eq('id', id)
      .maybeSingle()
    return { data: (data as unknown as ReviewRow) ?? null, error }
  }

  async findByProvider(providerId: string, accessToken?: string) {
    if (!supabaseConfigured) return { data: [], error: null }
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('reviews')
      .select(REVIEW_SELECT_COLUMNS)
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
    return { data: (data as unknown as ReviewRow[]) ?? null, error }
  }

  async findByCustomer(customerId: string, accessToken?: string) {
    if (!supabaseConfigured) return { data: [], error: null }
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('reviews')
      .select(REVIEW_SELECT_COLUMNS)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
    return { data: (data as unknown as ReviewRow[]) ?? null, error }
  }

  async insert(
    payload: {
      booking_id: string
      customer_id: string
      provider_id: string
      service_id: string
      rating: number
      comment: string
    },
    accessToken?: string
  ) {
    if (!supabaseConfigured) return { data: null, error: null }
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('reviews')
      .insert(payload)
      .select(REVIEW_SELECT_COLUMNS)
      .single()
    return { data: (data as unknown as ReviewRow) ?? null, error }
  }

  async update(
    id: string,
    payload: {
      rating?: number
      comment?: string
      edit_count: number
      is_edited: boolean
    },
    accessToken?: string
  ) {
    if (!supabaseConfigured) return { data: null, error: null }
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('reviews')
      .update(payload)
      .eq('id', id)
      .select(REVIEW_SELECT_COLUMNS)
      .maybeSingle()
    return { data: (data as unknown as ReviewRow) ?? null, error }
  }

  async delete(id: string, accessToken?: string) {
    if (!supabaseConfigured) return { data: null, error: null }
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('reviews')
      .delete()
      .eq('id', id)
      .select(REVIEW_SELECT_COLUMNS)
      .maybeSingle()
    return { data: (data as unknown as ReviewRow) ?? null, error }
  }
}

let activeReviewStore: ReviewStore = new SupabaseReviewStore()

export function setReviewStoreForTesting(store: ReviewStore): void {
  activeReviewStore = store
}

export function resetReviewStore(): void {
  activeReviewStore = new SupabaseReviewStore()
}

/**
 * Service functions implementing TPR-98 & TPR-99
 */

export async function createReview(
  customerId: string,
  rawInput: unknown,
  accessToken?: string
): Promise<ReviewDto> {
  const input = validateCreateReviewInput(rawInput)

  // 1. Validasi Transaksi (TPR-99)
  const { data: booking, error: bookingErr } = await activeReviewStore.findBookingById(
    input.bookingId,
    accessToken
  )

  if (bookingErr) {
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal memverifikasi status transaksi booking.')
  }
  if (!booking) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'Transaksi booking tidak ditemukan.')
  }

  // Cek kepemilikan booking
  if (booking.customer_id !== customerId) {
    throw new AppError(403, 'BOOKING_FORBIDDEN', 'Anda hanya dapat memberikan ulasan pada transaksi milik sendiri.')
  }

  // Cek status booking memenuhi syarat (hanya yang sudah 'accepted' / disetujui penyedia)
  if (booking.status !== 'accepted') {
    throw new AppError(
      400,
      'BOOKING_NOT_ELIGIBLE',
      'Ulasan hanya dapat diberikan setelah transaksi booking dikonfirmasi dan selesai oleh penyedia.'
    )
  }

  // 2. Mencegah Review Ganda untuk Booking yang Sama
  const { data: existingReview, error: existingErr } = await activeReviewStore.findReviewByBookingId(
    input.bookingId,
    accessToken
  )
  if (existingErr) {
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal memeriksa riwayat ulasan transaksi.')
  }
  if (existingReview) {
    throw new AppError(409, 'REVIEW_ALREADY_EXISTS', 'Transaksi booking ini sudah pernah diberi ulasan.')
  }

  // 3. Simpan Ulasan
  const { data: created, error: insertErr } = await activeReviewStore.insert(
    {
      booking_id: booking.id,
      customer_id: customerId,
      provider_id: booking.provider_id,
      service_id: booking.service_id,
      rating: input.rating,
      comment: input.comment,
    },
    accessToken
  )

  if (insertErr || !created) {
    if (insertErr?.code === '23505') {
      throw new AppError(409, 'REVIEW_ALREADY_EXISTS', 'Transaksi booking ini sudah pernah diberi ulasan.')
    }
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal menyimpan ulasan.')
  }

  return mapReviewRowToDto(created)
}

export async function updateReview(
  id: string,
  customerId: string,
  rawInput: unknown,
  accessToken?: string
): Promise<ReviewDto> {
  const validatedId = validateUuid(id, 'id')
  const input = validateUpdateReviewInput(rawInput)

  const { data: existing, error: findErr } = await activeReviewStore.findReviewById(
    validatedId,
    accessToken
  )

  if (findErr) {
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal memuat ulasan.')
  }
  if (!existing) {
    throw new AppError(404, 'REVIEW_NOT_FOUND', 'Ulasan tidak ditemukan.')
  }

  // Cek kepemilikan ulasan
  if (existing.customer_id !== customerId) {
    throw new AppError(403, 'REVIEW_FORBIDDEN', 'Anda tidak berhak mengubah ulasan milik pengguna lain.')
  }

  // Cek batas maksimal edit (TPR-99)
  if (existing.edit_count >= MAX_REVIEW_EDITS) {
    throw new AppError(
      400,
      'REVIEW_EDIT_LIMIT_EXCEEDED',
      `Batas maksimal pengubahan ulasan (${MAX_REVIEW_EDITS} kali) telah tercapai.`
    )
  }

  const { data: updated, error: updateErr } = await activeReviewStore.update(
    validatedId,
    {
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
      edit_count: existing.edit_count + 1,
      is_edited: true,
    },
    accessToken
  )

  if (updateErr || !updated) {
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal memperbarui ulasan.')
  }

  return mapReviewRowToDto(updated)
}

export async function deleteReview(
  id: string,
  customerId: string,
  accessToken?: string
): Promise<{ deletedId: string }> {
  const validatedId = validateUuid(id, 'id')

  const { data: existing, error: findErr } = await activeReviewStore.findReviewById(
    validatedId,
    accessToken
  )

  if (findErr) {
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal memuat ulasan.')
  }
  if (!existing) {
    throw new AppError(404, 'REVIEW_NOT_FOUND', 'Ulasan tidak ditemukan.')
  }

  // Cek kepemilikan ulasan
  if (existing.customer_id !== customerId) {
    throw new AppError(403, 'REVIEW_FORBIDDEN', 'Anda tidak berhak menarik ulasan milik pengguna lain.')
  }

  const { error: deleteErr } = await activeReviewStore.delete(validatedId, accessToken)
  if (deleteErr) {
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal menarik ulasan.')
  }

  return { deletedId: validatedId }
}

export async function getProviderReviews(
  providerId: string,
  accessToken?: string
): Promise<{ reviews: ReviewDto[]; stats: ProviderReviewStats }> {
  const validatedId = validateUuid(providerId, 'providerId')
  const { data, error } = await activeReviewStore.findByProvider(validatedId, accessToken)

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal memuat ulasan penyedia jasa.')
  }

  const reviews = (data || []).map(mapReviewRowToDto)
  const stats = calculateReviewStats(reviews)

  return { reviews, stats }
}

export async function getCustomerReviews(
  customerId: string,
  accessToken?: string
): Promise<{ reviews: ReviewDto[] }> {
  const { data, error } = await activeReviewStore.findByCustomer(customerId, accessToken)

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal memuat daftar ulasan Anda.')
  }

  return { reviews: (data || []).map(mapReviewRowToDto) }
}

export async function getReviewByBooking(
  bookingId: string,
  accessToken?: string
): Promise<{ review: ReviewDto | null }> {
  const validatedId = validateUuid(bookingId, 'bookingId')
  const { data, error } = await activeReviewStore.findReviewByBookingId(validatedId, accessToken)

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal memuat ulasan booking.')
  }

  return { review: data ? mapReviewRowToDto(data) : null }
}
