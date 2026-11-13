import { randomUUID } from 'node:crypto'
import { createSupabaseClient, supabaseConfigured } from '../config/supabase'
import { AppError } from '../lib/errors'
import type { DatabaseErrorLike } from './category.service'
import { getBooking } from './booking.service'

export const BOOKING_REQUIREMENTS_BUCKET = 'booking-references'

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
  findFile(path: string, token: string): Promise<{ data: boolean; error: DatabaseErrorLike | null }>
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
      if (status === '400' || status === '404') return { data: false, error: null }
      return { data: false, error: storageError(error) }
    }
    return { data: Boolean(data), error: null }
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
  if (mutate && booking.status !== 'pending_provider_confirmation') throw new AppError(409, 'BOOKING_REQUIREMENTS_LOCKED', 'Detail kebutuhan tidak dapat diubah setelah booking diproses penyedia.')
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

function validAttachment(item: unknown): AttachmentInput {
  if (!item || typeof item !== 'object') throw new AppError(400, 'VALIDATION_ERROR', 'Metadata foto tidak valid.')
  const value = item as Record<string, unknown>
  const fileName = typeof value.fileName === 'string' ? value.fileName.trim() : ''
  const storagePath = typeof value.storagePath === 'string' ? value.storagePath.trim() : ''
  const contentType = typeof value.contentType === 'string' ? value.contentType.trim().toLowerCase() : ''
  const fileSize = value.fileSize
  if (!fileName || fileName.length > 255 || !storagePath || !contentType.startsWith('image/') || typeof fileSize !== 'number' || !Number.isInteger(fileSize) || fileSize <= 0) throw new AppError(400, 'VALIDATION_ERROR', 'Metadata foto tidak valid.')
  return { fileName, storagePath, contentType, fileSize }
}

function pathFor(customerId: string, bookingId: string, path: string): boolean {
  return new RegExp(`^${customerId}/booking-${bookingId}/[0-9a-f-]{36}\\.(jpg|jpeg|png|webp)$`, 'i').test(path)
}

export async function getBookingRequirements(bookingId: string, actorId: string, role: string, token: string) {
  await assertBookingAccess(bookingId, token, actorId, role)
  const result = await store.findRequirement(bookingId, token)
  if (result.error) throw mapDbError('find_requirement', result.error)
  return result.data ? mapDto(result.data, token) : null
}

export async function createUploadUrl(bookingId: string, actorId: string, token: string, fileName: string, contentType: string, fileSize: number) {
  const booking = await assertBookingAccess(bookingId, token, actorId, 'customer', true)
  if (!fileName || fileName.length > 255 || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType) || !Number.isInteger(fileSize) || fileSize <= 0) throw new AppError(400, 'INVALID_FILE_TYPE', 'File referensi harus berupa gambar JPG, PNG, atau WEBP.')
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1] || 'bin'
  const storagePath = `${booking.customerId}/booking-${bookingId}/${randomUUID()}.${extension}`
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
    const file = await store.findFile(item.storagePath, token)
    if (file.error) throw mapDbError('check_uploaded_file', file.error)
    if (!file.data) throw new AppError(400, 'UPLOAD_NOT_FOUND', 'Foto belum terunggah. Silakan unggah ulang.')
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
  for (const item of additions) {
    if (!pathFor(actorId, bookingId, item.storagePath)) throw new AppError(400, 'INVALID_STORAGE_PATH', 'Lokasi foto tidak valid.')
    const file = await store.findFile(item.storagePath, token)
    if (file.error) throw mapDbError('check_uploaded_file_update', file.error)
    if (!file.data) throw new AppError(400, 'UPLOAD_NOT_FOUND', 'Foto belum terunggah. Silakan unggah ulang.')
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
