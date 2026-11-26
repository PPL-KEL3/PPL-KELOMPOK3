import { createSupabaseClient, supabaseConfigured } from '../config/supabase'
import { AppError } from '../lib/errors'

export const VERIFICATION_ISSUE_TYPES = [
  'amount_mismatch',
  'gateway_status_mismatch',
  'payment_confirmation_problem',
  'suspected_duplicate',
  'payment_session_problem',
  'other',
] as const
export type VerificationIssueType = (typeof VERIFICATION_ISSUE_TYPES)[number]
export const VERIFICATION_STATUSES = ['open', 'in_progress', 'resolved', 'duplicate', 'closed'] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

const ALLOWED_STATUS_TRANSITIONS: Record<VerificationStatus, readonly VerificationStatus[]> = {
  open: ['in_progress', 'resolved', 'duplicate'],
  in_progress: ['resolved', 'duplicate'],
  resolved: ['closed'],
  duplicate: ['closed'],
  closed: [],
}

export interface VerificationCaseDto {
  id: string
  paymentId: string
  bookingId: string
  issueType: VerificationIssueType
  description: string
  status: VerificationStatus
  assignedAdminId: string | null
  createdBy: string
  decisionNotes: string | null
  duplicateOfCaseId: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  payment: { amount: number; status: string; paymentMethod: string; paidAt: string | null } | null
}

interface CaseRow {
  id: string
  payment_id: string
  booking_id: string
  issue_type: VerificationIssueType
  description: string
  status: VerificationStatus
  assigned_admin_id: string | null
  created_by: string
  decision_notes: string | null
  duplicate_of_case_id: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
  payments?: { amount?: number; status?: string; payment_method?: string; paid_at?: string | null } | Array<{ amount?: number; status?: string; payment_method?: string; paid_at?: string | null }>
}

const CASE_COLUMNS = 'id, payment_id, booking_id, issue_type, description, status, assigned_admin_id, created_by, decision_notes, duplicate_of_case_id, closed_at, created_at, updated_at, payments(amount, status, payment_method, paid_at)'

function ensureConfigured() {
  if (!supabaseConfigured) throw new AppError(503, 'PAYMENT_VERIFICATION_UNAVAILABLE', 'Layanan verifikasi pembayaran belum dikonfigurasi.')
}

function mapError(error: { code?: string }) {
  if (error.code === '42P01' || error.code === 'PGRST205') return new AppError(503, 'PAYMENT_VERIFICATION_TABLE_UNAVAILABLE', 'Tabel kasus verifikasi belum tersedia. Jalankan migration kasus pembayaran.')
  if (error.code === '23503') return new AppError(400, 'INVALID_PAYMENT_REFERENCE', 'Payment, booking, atau admin yang dirujuk tidak ditemukan.')
  if (error.code === '23514') return new AppError(400, 'VALIDATION_ERROR', 'Data kasus verifikasi tidak valid.')
  console.error('[payment-verification] Database error', { code: error.code ?? 'unknown' })
  return new AppError(502, 'PAYMENT_VERIFICATION_ERROR', 'Layanan kasus verifikasi sedang bermasalah.')
}

function nestedPayment(value: CaseRow['payments']) {
  return Array.isArray(value) ? value[0] : value
}

function mapRow(row: CaseRow): VerificationCaseDto {
  const payment = nestedPayment(row.payments)
  return {
    id: row.id,
    paymentId: row.payment_id,
    bookingId: row.booking_id,
    issueType: row.issue_type,
    description: row.description,
    status: row.status,
    assignedAdminId: row.assigned_admin_id,
    createdBy: row.created_by,
    decisionNotes: row.decision_notes,
    duplicateOfCaseId: row.duplicate_of_case_id,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payment: payment ? { amount: Number(payment.amount), status: payment.status ?? 'unknown', paymentMethod: payment.payment_method ?? 'qris', paidAt: payment.paid_at ?? null } : null,
  }
}

function validateIssueType(value: unknown): VerificationIssueType {
  if (typeof value === 'string' && (VERIFICATION_ISSUE_TYPES as readonly string[]).includes(value)) return value as VerificationIssueType
  throw new AppError(400, 'INVALID_VERIFICATION_ISSUE_TYPE', 'Jenis ketidaksesuaian pembayaran tidak valid.')
}

function validateStatus(value: unknown): VerificationStatus {
  if (typeof value === 'string' && (VERIFICATION_STATUSES as readonly string[]).includes(value)) return value as VerificationStatus
  throw new AppError(400, 'INVALID_VERIFICATION_STATUS', 'Status pemeriksaan tidak valid.')
}

export function validateVerificationStatusTransition(current: VerificationStatus, next: VerificationStatus): void {
  if (current === next) return
  if (!ALLOWED_STATUS_TRANSITIONS[current].includes(next)) {
    throw new AppError(409, 'INVALID_VERIFICATION_STATUS_TRANSITION', `Kasus tidak dapat berpindah dari ${current} ke ${next}.`)
  }
}

export function normalizeDecisionNote(value: unknown, field = 'Catatan keputusan'): string {
  return validateText(value, field)
}

function validateText(value: unknown, field: string, max = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new AppError(400, 'VALIDATION_ERROR', `${field} wajib diisi dan maksimal ${max} karakter.`)
  return value.trim()
}

export async function listVerificationCases(input: { page: number; pageSize: number; search?: string; status?: string; issueType?: string }, accessToken: string) {
  ensureConfigured()
  let query = createSupabaseClient(accessToken).from('payment_verification_cases').select(CASE_COLUMNS, { count: 'exact' }).order('created_at', { ascending: false }).range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1)
  if (input.status) query = query.eq('status', validateStatus(input.status))
  if (input.issueType) query = query.eq('issue_type', validateIssueType(input.issueType))
  if (input.search?.trim()) {
    const search = input.search.trim().replace(/[%(),]/g, '')
    if (search) query = query.or(`id.ilike.%${search}%,payment_id.ilike.%${search}%,booking_id.ilike.%${search}%,description.ilike.%${search}%`)
  }
  query = query.is('deleted_at', null)
  const { data, error, count } = await query
  if (error) throw mapError(error)
  return { cases: ((data ?? []) as CaseRow[]).map(mapRow), pagination: { page: input.page, pageSize: input.pageSize, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / input.pageSize) } }
}

export async function createVerificationCase(input: { paymentId: string; issueType: unknown; description: unknown; assignedAdminId?: string | null }, adminId: string, accessToken: string) {
  ensureConfigured()
  const issueType = validateIssueType(input.issueType)
  const description = validateText(input.description, 'Deskripsi kasus')
  const { data: payment, error: paymentError } = await createSupabaseClient(accessToken).from('payments').select('id, booking_id').eq('id', input.paymentId).maybeSingle()
  if (paymentError) throw mapError(paymentError)
  if (!payment) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment tidak ditemukan.')
  const { data, error } = await createSupabaseClient(accessToken).from('payment_verification_cases').insert({ payment_id: payment.id, booking_id: payment.booking_id, issue_type: issueType, description, assigned_admin_id: input.assignedAdminId ?? null, created_by: adminId }).select(CASE_COLUMNS).single()
  if (error) throw mapError(error)
  if (!data) throw new AppError(502, 'VERIFICATION_CASE_CREATE_FAILED', 'Kasus verifikasi gagal dibuat.')
  return mapRow(data as CaseRow)
}

export async function getVerificationCase(caseId: string, accessToken: string) {
  ensureConfigured()
  const { data, error } = await createSupabaseClient(accessToken).from('payment_verification_cases').select(CASE_COLUMNS).eq('id', caseId).is('deleted_at', null).maybeSingle()
  if (error) throw mapError(error)
  if (!data) throw new AppError(404, 'VERIFICATION_CASE_NOT_FOUND', 'Kasus verifikasi tidak ditemukan.')
  return mapRow(data as CaseRow)
}

export async function deleteVerificationCase(caseId: string, adminId: string, accessToken: string) {
  const current = await getVerificationCase(caseId, accessToken)
  if (current.status === 'closed') throw new AppError(409, 'VERIFICATION_CASE_CLOSED', 'Kasus yang sudah ditutup tidak dapat dihapus.')
  const note = 'Kasus diarsipkan oleh administrator melalui operasi hapus.'
  const { data, error } = await createSupabaseClient(accessToken)
    .from('payment_verification_cases')
    .update({ deleted_at: new Date().toISOString(), decision_notes: note, assigned_admin_id: current.assignedAdminId ?? adminId })
    .eq('id', caseId)
    .is('deleted_at', null)
    .select('id, deleted_at')
    .maybeSingle()
  if (error) throw mapError(error)
  if (!data) throw new AppError(409, 'VERIFICATION_CASE_DELETE_CONFLICT', 'Kasus berubah bersamaan. Muat ulang data.')
  return { id: data.id as string, deletedAt: data.deleted_at as string }
}

export async function updateVerificationCase(caseId: string, input: { status?: unknown; decisionNotes?: unknown; assignedAdminId?: string | null }, adminId: string, accessToken: string) {
  const current = await getVerificationCase(caseId, accessToken)
  if (current.status === 'closed') throw new AppError(409, 'VERIFICATION_CASE_CLOSED', 'Kasus yang sudah ditutup tidak dapat diubah.')
  const changes: Record<string, unknown> = {}
  const nextStatus = input.status === undefined ? current.status : validateStatus(input.status)
  if (nextStatus === 'closed') throw new AppError(400, 'USE_CLOSE_ENDPOINT', 'Gunakan endpoint penutupan untuk menutup kasus.')
  validateVerificationStatusTransition(current.status, nextStatus)
  if (input.status !== undefined && nextStatus !== current.status && input.decisionNotes === undefined) throw new AppError(400, 'DECISION_NOTE_REQUIRED', 'Alasan wajib diisi ketika status pemeriksaan berubah.')
  if (input.decisionNotes !== undefined) changes.decision_notes = input.decisionNotes === null ? null : normalizeDecisionNote(input.decisionNotes)
  if (input.assignedAdminId !== undefined) changes.assigned_admin_id = input.assignedAdminId
  if (input.status !== undefined) changes.status = nextStatus
  changes.assigned_admin_id ??= adminId
  if (!Object.keys(changes).length) throw new AppError(400, 'VALIDATION_ERROR', 'Tidak ada perubahan kasus yang dikirim.')
  const { data, error } = await createSupabaseClient(accessToken).from('payment_verification_cases').update(changes).eq('id', caseId).eq('status', current.status).select(CASE_COLUMNS).maybeSingle()
  if (error) throw mapError(error)
  if (!data) throw new AppError(409, 'VERIFICATION_CASE_UPDATE_CONFLICT', 'Kasus berubah bersamaan. Muat ulang data.')
  return mapRow(data as CaseRow)
}

export async function closeVerificationCase(caseId: string, note: unknown, adminId: string, accessToken: string) {
  const current = await getVerificationCase(caseId, accessToken)
  if (current.status === 'closed') return current
  if (current.status !== 'resolved' && current.status !== 'duplicate') throw new AppError(409, 'VERIFICATION_CASE_NOT_READY_TO_CLOSE', 'Kasus harus berstatus selesai atau duplikat sebelum ditutup.')
  const decisionNotes = note === undefined || note === null ? normalizeDecisionNote(current.decisionNotes, 'Catatan penutupan') : normalizeDecisionNote(note, 'Catatan penutupan')
  const { data, error } = await createSupabaseClient(accessToken).from('payment_verification_cases').update({ status: 'closed', closed_at: new Date().toISOString(), decision_notes: decisionNotes, assigned_admin_id: current.assignedAdminId ?? adminId }).eq('id', caseId).eq('status', current.status).select(CASE_COLUMNS).maybeSingle()
  if (error) throw mapError(error)
  if (!data) throw new AppError(409, 'VERIFICATION_CASE_UPDATE_CONFLICT', 'Kasus berubah bersamaan. Muat ulang data.')
  return mapRow(data as CaseRow)
}

export async function markVerificationDuplicate(caseId: string, duplicateOfCaseId: string, note: unknown, adminId: string, accessToken: string) {
  if (caseId === duplicateOfCaseId) throw new AppError(400, 'DUPLICATE_CASE_SELF_REFERENCE', 'Kasus tidak dapat ditandai sebagai duplikat dirinya sendiri.')
  const current = await getVerificationCase(caseId, accessToken)
  if (current.status === 'closed') throw new AppError(409, 'VERIFICATION_CASE_CLOSED', 'Kasus yang sudah ditutup tidak dapat diubah.')
  const primary = await getVerificationCase(duplicateOfCaseId, accessToken)
  if (primary.status === 'duplicate') throw new AppError(400, 'INVALID_DUPLICATE_PRIMARY', 'Kasus utama tidak boleh berstatus duplikat.')
  const decisionNotes = note === undefined || note === null ? normalizeDecisionNote(current.decisionNotes, 'Alasan duplikat') : normalizeDecisionNote(note, 'Alasan duplikat')
  const { data, error } = await createSupabaseClient(accessToken).from('payment_verification_cases').update({ status: 'duplicate', duplicate_of_case_id: primary.id, decision_notes: decisionNotes, assigned_admin_id: current.assignedAdminId ?? adminId }).eq('id', caseId).eq('status', current.status).select(CASE_COLUMNS).maybeSingle()
  if (error) throw mapError(error)
  if (!data) throw new AppError(409, 'VERIFICATION_CASE_UPDATE_CONFLICT', 'Kasus berubah bersamaan. Muat ulang data.')
  return mapRow(data as CaseRow)
}
