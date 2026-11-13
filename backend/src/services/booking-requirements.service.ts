import { randomUUID } from 'node:crypto'
import { createSupabaseClient, supabaseConfigured } from '../config/supabase'
import { AppError } from '../lib/errors'
import type { DatabaseErrorLike } from './category.service'
import { getBooking } from './booking.service'

export const BOOKING_REQUIREMENTS_BUCKET = 'booking-references'
export const BOOKING_REQUIREMENTS_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
// Belum ada batas bisnis khusus pada schema/konfigurasi LOKA saat TPR-79 dikerjakan.
export const BOOKING_REQUIREMENTS_MAX_FILE_SIZE: number | null = null
export const BOOKING_REQUIREMENTS_MAX_ATTACHMENTS: number | null = null

interface RequirementRow {
  id: string
  booking_id: string
  notes: string | null
  created_at: string
  updated_at: string
}

interface AttachmentRow {
  id: string
  requirement_id: string
  file_name: string
  storage_path: string
  content_type: string
  file_size: number
  created_at: string
}

export interface BookingRequirementAttachment {
  id: string
  fileName: string
  storagePath: string
  contentType: string
  fileSize: number
  createdAt: string
  url: string
}

export interface BookingRequirementsDto {
  id: string
  bookingId: string
  notes: string | null
  createdAt: string
  updatedAt: string
  attachments: BookingRequirementAttachment[]
}

export interface BookingRequirementsInput {
  notes?: string | null
  attachments?: AttachmentInput[]
}

export interface AttachmentInput {
  fileName: string
  storagePath: string
  contentType: string
  fileSize: number
}

interface Store {
  findRequirement(bookingId: string, token: string): Promise<{ data: RequirementRow | null; error: DatabaseErrorLike | null }>
  findAttachments(requirementId: string, token: string): Promise<{ data: AttachmentRow[] | null; error: DatabaseErrorLike | null }>
  insertRequirement(bookingId: string, notes: string | null, token: string): Promise<{ data: RequirementRow | null; error: DatabaseErrorLike | null }>
  updateRequirement(id: string, notes: string | null, token: string): Promise<{ data: RequirementRow | null; error: DatabaseErrorLike | null }>
  deleteRequirement(id: string, token: string): Promise<{ data: RequirementRow | null; error: DatabaseErrorLike | null }>
  insertAttachments(requirementId: string, attachments: AttachmentInput[], token: string): Promise<{ data: AttachmentRow[] | null; error: DatabaseErrorLike | null }>
  deleteAttachment(id: string, token: string): Promise<{ data: AttachmentRow | null; error: DatabaseErrorLike | null }>
  createSignedUploadUrl(path: string, token: string): Promise<{ data: string | null; error: DatabaseErrorLike | null }>
  createSignedUrl(path: string, token: string): Promise<{ data: string | null; error: DatabaseErrorLike | null }>
  findFile(path: string, token: string): Promise<{ data: { size: number | null; contentType: string | null } | null; error: DatabaseErrorLike | null }>
  downloadFile(path: string, token: string): Promise<{ data: Uint8Array | null; error: DatabaseErrorLike | null }>
  removeFiles(paths: string[], token: string): Promise<{ data: string[] | null; error: DatabaseErrorLike | null }>
}

const REQUIREMENT_COLUMNS = 'id, booking_id, notes, created_at, updated_at'
const ATTACHMENT_COLUMNS = 'id, requirement_id, file_name, storage_path, content_type, file_size, created_at'

function ensureConfigured() {
  if (!supabaseConfigured) throw new AppError(503, 'BOOKING_REQUIREMENTS_UNAVAILABLE', 'Layanan detail kebutuhan belum dikonfigurasi.')
}

function storageError(error: { message?: string; statusCode?: string } | null): DatabaseErrorLike | null {
  return error ? { code: `STORAGE_${error.statusCode ?? 'ERROR'}`, message: error.message } : null
}

const store: Store = {
  async findRequirement(bookingId, token) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(token).from('booking_requirements').select(REQUIREMENT_COLUMNS).eq('booking_id', bookingId).maybeSingle()
    return { data: data as RequirementRow | null, error }
  },
  async findAttachments(requirementId, token) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(token).from('booking_requirement_attachments').select(ATTACHMENT_COLUMNS).eq('requirement_id', requirementId).order('created_at', { ascending: true })
    return { data: data as AttachmentRow[] | null, error }
  },
  async insertRequirement(bookingId, notes, token) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(token).from('booking_requirements').insert({ booking_id: bookingId, notes }).select(REQUIREMENT_COLUMNS).single()
    return { data: data as RequirementRow | null, error }
  },
  async updateRequirement(id, notes, token) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(token).from('booking_requirements').update({ notes }).eq('id', id).select(REQUIREMENT_COLUMNS).maybeSingle()
    return { data: data as RequirementRow | null, error }
  },
  async deleteRequirement(id, token) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(token).from('booking_requirements').delete().eq('id', id).select(REQUIREMENT_COLUMNS).maybeSingle()
    return { data: data as RequirementRow | null, error }
  },
  async insertAttachments(requirementId, attachments, token) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(token).from('booking_requirement_attachments').insert(attachments.map((item) => ({ requirement_id: requirementId, file_name: item.fileName, storage_path: item.storagePath, content_type: item.contentType, file_size: item.fileSize }))).select(ATTACHMENT_COLUMNS)
    return { data: data as AttachmentRow[] | null, error }
  },
  async deleteAttachment(id, token) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(token).from('booking_requirement_attachments').delete().eq('id', id).select(ATTACHMENT_COLUMNS).maybeSingle()
    return { data: data as AttachmentRow | null, error }
  },
  async createSignedUploadUrl(path, token) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(token).storage.from(BOOKING_REQUIREMENTS_BUCKET).createSignedUploadUrl(path)
    return { data: data?.signedUrl ?? null, error: storageError(error) }
  },
  async createSignedUrl(path, token) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(token).storage.from(BOOKING_REQUIREMENTS_BUCKET).createSignedUrl(path, 3600)
    return { data: data?.signedUrl ?? null, error: storageError(error) }
  },
  async findFile(path, token) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(token).storage.from(BOOKING_REQUIREMENTS_BUCKET).info(path)
    if (error) {
      const status = String((error as { statusCode?: string; status?: number }).statusCode ?? (error as { status?: number }).status ?? '')
      if (status === '400' || status === '404') return { data: null, error: null }
      return { data: null, error: storageError(error) }
    }
    return { data: data ? { size: typeof data.size === 'number' ? data.size : null, contentType: data.contentType ?? null } : null, error: null }
  },
  async downloadFile(path, token) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(token).storage.from(BOOKING_REQUIREMENTS_BUCKET).download(path)
    if (error) return { data: null, error: storageError(error) }
    return { data: data ? new Uint8Array(await data.arrayBuffer()) : null, error: null }
  },
  async removeFiles(paths, token) {
    ensureConfigured()
    const { data, error } = await createSupabaseClient(token).storage.from(BOOKING_REQUIREMENTS_BUCKET).remove(paths)
    return { data: data?.map((file) => file.name) ?? null, error: storageError(error) }
  },
}

function mapDbError(action: string, error: DatabaseErrorLike): AppError {
  const code = error.code ?? ''
  if (code === '23505') return new AppError(409, 'BOOKING_REQUIREMENTS_CONFLICT', 'Detail kebutuhan booking sudah tersedia.')
  if (code === '23514') return new AppError(400, 'VALIDATION_ERROR', 'Data detail kebutuhan tidak valid.')
  if (code === '42501') return new AppError(403, 'BOOKING_REQUIREMENTS_FORBIDDEN', 'Kamu tidak memiliki akses ke detail kebutuhan ini.')
  if (code === '42P01' || code === 'PGRST205') return new AppError(503, 'BOOKING_REQUIREMENTS_TABLE_UNAVAILABLE', 'Tabel detail kebutuhan belum tersedia pada database.')
  console.error('[booking-requirements] Database error', { action, code: code || 'unknown' })
  return new AppError(502, 'BOOKING_REQUIREMENTS_SERVICE_ERROR', 'Detail kebutuhan sedang bermasalah. Silakan coba lagi.')
}

function notFound() { return new AppError(404, 'BOOKING_REQUIREMENTS_NOT_FOUND', 'Detail kebutuhan booking tidak ditemukan.') }

async function assertBookingAccess(bookingId: string, token: string, actorId: string, role: string, mutate = false) {
  const booking = await getBooking(bookingId, token)
  if (role === 'admin') return booking
  if (booking.customerId !== actorId && booking.providerId !== actorId) throw new AppError(403, 'BOOKING_REQUIREMENTS_FORBIDDEN', 'Kamu tidak memiliki akses ke detail kebutuhan ini.')
  if (mutate && (role !== 'customer' || booking.customerId !== actorId)) throw new AppError(403, 'BOOKING_REQUIREMENTS_FORBIDDEN', 'Hanya customer pemilik booking yang dapat mengubah detail kebutuhan.')
  if (mutate && !isBookingRequirementsEditable(booking.status)) throw new AppError(409, 'BOOKING_REQUIREMENTS_LOCKED', 'Detail kebutuhan tidak dapat diubah setelah booking diproses penyedia.')
  return booking
}

async function mapDto(row: RequirementRow, token: string): Promise<BookingRequirementsDto> {
  const attachmentsResult = await store.findAttachments(row.id, token)
  if (attachmentsResult.error) throw mapDbError('find_attachments', attachmentsResult.error)
  const attachments = await Promise.all((attachmentsResult.data ?? []).map(async (item) => {
    const signed = await store.createSignedUrl(item.storage_path, token)
    if (signed.error || !signed.data) throw new AppError(502, 'BOOKING_REQUIREMENTS_FILE_ERROR', 'Foto referensi tidak dapat diakses.')
    return { id: item.id, fileName: item.file_name, storagePath: item.storage_path, contentType: item.content_type, fileSize: Number(item.file_size), createdAt: item.created_at, url: signed.data }
  }))
  return { id: row.id, bookingId: row.booking_id, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at, attachments }
}

function normalizeNotes(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new AppError(400, 'VALIDATION_ERROR', 'Catatan kebutuhan harus berupa teks.', { notes: 'Catatan kebutuhan harus berupa teks.' })
  return value.trim() || null
}

export function isBookingRequirementsEditable(status: string): boolean {
  return status === 'pending_provider_confirmation'
}

export function hasValidImageSignature(contentType: string, bytes: Uint8Array): boolean {
  if (contentType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (contentType === 'image/png') return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  if (contentType === 'image/webp') return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  return false
}

function validAttachment(item: unknown): AttachmentInput {
  if (!item || typeof item !== 'object') throw new AppError(400, 'VALIDATION_ERROR', 'Metadata foto tidak valid.')
  const value = item as Record<string, unknown>
  const fileName = typeof value.fileName === 'string' ? value.fileName.trim() : ''
  const storagePath = typeof value.storagePath === 'string' ? value.storagePath.trim() : ''
  const contentType = typeof value.contentType === 'string' ? value.contentType.trim().toLowerCase() : ''
  const fileSize = value.fileSize
  const extension = fileName.toLowerCase().split('.').pop()
  const extensions: Record<string, string[]> = { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'] }
  if (!fileName || fileName.length > 255 || /[\\/\0]/.test(fileName) || !storagePath || !(BOOKING_REQUIREMENTS_ALLOWED_TYPES as readonly string[]).includes(contentType) || !extensions[contentType]?.includes(extension ?? '') || typeof fileSize !== 'number' || !Number.isInteger(fileSize) || fileSize <= 0) throw new AppError(400, 'VALIDATION_ERROR', 'Metadata foto tidak valid.')
  if (BOOKING_REQUIREMENTS_MAX_FILE_SIZE !== null && fileSize > BOOKING_REQUIREMENTS_MAX_FILE_SIZE) throw new AppError(400, 'FILE_TOO_LARGE', 'Ukuran foto melebihi batas yang diizinkan.')
  return { fileName, storagePath, contentType, fileSize }
}

function pathFor(customerId: string, bookingId: string, path: string): boolean {
  return new RegExp(`^${customerId}/booking-${bookingId}/[0-9a-f-]{36}\\.(jpg|jpeg|png|webp)$`, 'i').test(path)
}

async function assertUploadedImage(item: AttachmentInput, token: string): Promise<void> {
  const file = await store.findFile(item.storagePath, token)
  if (file.error) throw mapDbError('check_uploaded_file', file.error)
  if (!file.data || file.data.size === null || file.data.size <= 0) throw new AppError(400, 'UPLOAD_NOT_FOUND', 'Foto belum terunggah atau file kosong. Silakan unggah ulang.')
  if (file.data.size !== item.fileSize) throw new AppError(400, 'FILE_METADATA_MISMATCH', 'Ukuran foto tidak sesuai dengan file yang diunggah.')
  if (file.data.contentType && file.data.contentType !== item.contentType) throw new AppError(400, 'INVALID_FILE_TYPE', 'Tipe konten foto tidak sesuai dengan metadata.')
  if (BOOKING_REQUIREMENTS_MAX_FILE_SIZE !== null && file.data.size > BOOKING_REQUIREMENTS_MAX_FILE_SIZE) throw new AppError(400, 'FILE_TOO_LARGE', 'Ukuran foto melebihi batas yang diizinkan.')
  const bytes = await store.downloadFile(item.storagePath, token)
  if (bytes.error) throw mapDbError('read_uploaded_file', bytes.error)
  if (!bytes.data || !hasValidImageSignature(item.contentType, bytes.data)) throw new AppError(400, 'INVALID_FILE_CONTENT', 'Isi file bukan foto yang valid atau file rusak.')
}

export async function getBookingRequirements(bookingId: string, actorId: string, role: string, token: string) {
  await assertBookingAccess(bookingId, token, actorId, role)
  const result = await store.findRequirement(bookingId, token)
  if (result.error) throw mapDbError('find_requirement', result.error)
  return result.data ? mapDto(result.data, token) : null
}

export async function createUploadUrl(bookingId: string, actorId: string, token: string, fileName: string, contentType: string, fileSize: number) {
  const booking = await assertBookingAccess(bookingId, token, actorId, 'customer', true)
  const extension = fileName.toLowerCase().split('.').pop()
  const allowedExtensions: Record<string, string[]> = { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'] }
  if (!fileName || fileName.length > 255 || /[\\/\0]/.test(fileName) || !allowedExtensions[contentType]?.includes(extension ?? '') || !Number.isInteger(fileSize) || fileSize <= 0) throw new AppError(400, 'INVALID_FILE_TYPE', 'File referensi harus berupa gambar JPG, PNG, atau WEBP.')
  if (BOOKING_REQUIREMENTS_MAX_FILE_SIZE !== null && fileSize > BOOKING_REQUIREMENTS_MAX_FILE_SIZE) throw new AppError(400, 'FILE_TOO_LARGE', 'Ukuran foto melebihi batas yang diizinkan.')
  const storageExtension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1] || 'bin'
  const storagePath = `${booking.customerId}/booking-${bookingId}/${randomUUID()}.${storageExtension}`
  const result = await store.createSignedUploadUrl(storagePath, token)
  if (result.error || !result.data) throw new AppError(502, 'BOOKING_REQUIREMENTS_UPLOAD_ERROR', 'Tautan unggah foto gagal dibuat.')
  return { uploadUrl: result.data, storagePath }
}

export async function createBookingRequirements(bookingId: string, input: BookingRequirementsInput, actorId: string, token: string) {
  await assertBookingAccess(bookingId, token, actorId, 'customer', true)
  const existing = await store.findRequirement(bookingId, token)
  if (existing.error) throw mapDbError('find_before_create', existing.error)
  if (existing.data) throw new AppError(409, 'BOOKING_REQUIREMENTS_EXISTS', 'Detail kebutuhan booking sudah tersedia. Gunakan endpoint pembaruan.')
  const attachments = (input.attachments ?? []).map(validAttachment)
  for (const item of attachments) {
    if (!pathFor(actorId, bookingId, item.storagePath)) throw new AppError(400, 'INVALID_STORAGE_PATH', 'Lokasi foto tidak valid.')
    await assertUploadedImage(item, token)
  }
  const created = await store.insertRequirement(bookingId, normalizeNotes(input.notes), token)
  if (created.error) throw mapDbError('create_requirement', created.error)
  if (!created.data) throw new AppError(502, 'BOOKING_REQUIREMENTS_CREATE_FAILED', 'Detail kebutuhan gagal disimpan.')
  try {
    if (attachments.length) {
      const inserted = await store.insertAttachments(created.data.id, attachments, token)
      if (inserted.error) throw mapDbError('create_attachments', inserted.error)
    }
    return mapDto(created.data, token)
  } catch (error) {
    await store.deleteRequirement(created.data.id, token)
    await store.removeFiles(attachments.map((item) => item.storagePath), token)
    throw error
  }
}

export async function updateBookingRequirements(bookingId: string, input: BookingRequirementsInput, actorId: string, token: string) {
  await assertBookingAccess(bookingId, token, actorId, 'customer', true)
  const current = await store.findRequirement(bookingId, token)
  if (current.error) throw mapDbError('find_for_update', current.error)
  if (!current.data) throw notFound()
  const additions = (input.attachments ?? []).map(validAttachment)
  if (BOOKING_REQUIREMENTS_MAX_ATTACHMENTS !== null) {
    const existingAttachments = await store.findAttachments(current.data.id, token)
    if (existingAttachments.error) throw mapDbError('count_attachments', existingAttachments.error)
    if ((existingAttachments.data?.length ?? 0) + additions.length > BOOKING_REQUIREMENTS_MAX_ATTACHMENTS) throw new AppError(400, 'ATTACHMENT_LIMIT_REACHED', 'Jumlah foto referensi melebihi batas yang diizinkan.')
  }
  for (const item of additions) {
    if (!pathFor(actorId, bookingId, item.storagePath)) throw new AppError(400, 'INVALID_STORAGE_PATH', 'Lokasi foto tidak valid.')
    await assertUploadedImage(item, token)
  }
  const updated = input.notes === undefined ? { data: current.data, error: null } : await store.updateRequirement(current.data.id, normalizeNotes(input.notes), token)
  if (updated.error) throw mapDbError('update_requirement', updated.error)
  if (!updated.data) throw notFound()
  try {
    if (additions.length) {
      const result = await store.insertAttachments(current.data.id, additions, token)
      if (result.error) throw mapDbError('add_attachments', result.error)
    }
    return mapDto(updated.data, token)
  } catch (error) {
    await store.removeFiles(additions.map((item) => item.storagePath), token)
    throw error
  }
}

export async function deleteBookingRequirementAttachment(bookingId: string, attachmentId: string, actorId: string, token: string) {
  await assertBookingAccess(bookingId, token, actorId, 'customer', true)
  const current = await store.findRequirement(bookingId, token)
  if (current.error) throw mapDbError('find_for_delete_attachment', current.error)
  if (!current.data) throw notFound()
  const attachments = await store.findAttachments(current.data.id, token)
  if (attachments.error) throw mapDbError('find_attachment', attachments.error)
  const target = (attachments.data ?? []).find((item) => item.id === attachmentId)
  if (!target) throw new AppError(404, 'BOOKING_ATTACHMENT_NOT_FOUND', 'Lampiran tidak ditemukan.')
  const deleted = await store.deleteAttachment(attachmentId, token)
  if (deleted.error) throw mapDbError('delete_attachment', deleted.error)
  if (!deleted.data) throw new AppError(404, 'BOOKING_ATTACHMENT_NOT_FOUND', 'Lampiran tidak ditemukan.')
  const removed = await store.removeFiles([target.storage_path], token)
  return { deletedId: attachmentId, fileCleanupFailed: Boolean(removed.error || !removed.data?.length) }
}

export async function deleteBookingRequirements(bookingId: string, actorId: string, token: string) {
  await assertBookingAccess(bookingId, token, actorId, 'customer', true)
  const current = await store.findRequirement(bookingId, token)
  if (current.error) throw mapDbError('find_for_delete', current.error)
  if (!current.data) throw notFound()
  const attachments = await store.findAttachments(current.data.id, token)
  if (attachments.error) throw mapDbError('find_attachments_for_delete', attachments.error)
  const deleted = await store.deleteRequirement(current.data.id, token)
  if (deleted.error) throw mapDbError('delete_requirement', deleted.error)
  if (!deleted.data) throw notFound()
  const removed = await store.removeFiles((attachments.data ?? []).map((item) => item.storage_path), token)
  return { deletedId: current.data.id, fileCleanupFailed: Boolean(removed.error) }
}
