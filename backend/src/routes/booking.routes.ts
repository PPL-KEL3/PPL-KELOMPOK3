import { Router, type Request, type RequestHandler } from 'express'
import { AppError } from '../lib/errors'
import { asyncHandler, sendSuccess } from '../lib/http'
import { asString } from '../lib/validation'
import { requireAuth } from '../middleware/auth.middleware'
import {
  acceptBooking,
  cancelBooking,
  createBooking,
  getBooking,
  listCustomerBookings,
  listProviderBookings,
  rejectBooking,
  updateCustomerBooking,
  type CreateBookingInput,
  type UpdateBookingInput,
} from '../services/booking.service'
import { requireProvider } from './service.routes'
import {
  createBookingRequirements,
  createUploadUrl as createRequirementsUploadUrl,
  deleteBookingRequirementAttachment,
  deleteBookingRequirements,
  getBookingRequirements,
  updateBookingRequirements,
  type BookingRequirementsInput,
} from '../services/booking-requirements.service'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function body(req: Request): Record<string, unknown> { return (req.body ?? {}) as Record<string, unknown> }

function parseRequirementsPayload(input: Record<string, unknown>): BookingRequirementsInput {
  const payload: BookingRequirementsInput = {}
  if (Object.prototype.hasOwnProperty.call(input, 'notes')) payload.notes = input.notes as string | null
  if (Object.prototype.hasOwnProperty.call(input, 'attachments')) {
    if (!Array.isArray(input.attachments)) throw new AppError(400, 'VALIDATION_ERROR', 'Lampiran harus berupa daftar.')
    payload.attachments = input.attachments as BookingRequirementsInput['attachments']
  }
  if (!Object.keys(payload).length) throw new AppError(400, 'VALIDATION_ERROR', 'Minimal catatan atau lampiran harus diisi.')
  return payload
}

function parseId(raw: unknown): string {
  const id = asString(raw).trim()
  if (!UUID_PATTERN.test(id)) throw new AppError(400, 'INVALID_BOOKING_ID', 'Format ID booking tidak valid.')
  return id
}

function parseDate(raw: unknown, required: boolean, errors: Record<string, string>): string | undefined {
  if (raw === undefined && !required) return undefined
  const value = asString(raw).trim()
  if (!value) { errors.workDate = 'Tanggal pengerjaan wajib diisi.'; return undefined }
  if (!DATE_PATTERN.test(value)) errors.workDate = 'Format tanggal pengerjaan tidak valid.'
  return value
}

function parseTime(raw: unknown, required: boolean, errors: Record<string, string>): string | undefined {
  if (raw === undefined && !required) return undefined
  const value = asString(raw).trim()
  if (!value) errors.workTime = 'Waktu pengerjaan wajib diisi.'
  else if (value.length > 50) errors.workTime = 'Waktu pengerjaan terlalu panjang.'
  return value || undefined
}

function parseCreatePayload(input: Record<string, unknown>): CreateBookingInput {
  const errors: Record<string, string> = {}
  const serviceId = asString(input.serviceId).trim()
  if (!UUID_PATTERN.test(serviceId)) errors.serviceId = 'Format ID jasa tidak valid.'
  const packageId = input.packageId === undefined || input.packageId === null || input.packageId === '' ? null : asString(input.packageId).trim()
  if (packageId !== null && !UUID_PATTERN.test(packageId)) errors.packageId = 'Format ID paket tidak valid.'
  const workDate = parseDate(input.workDate, true, errors) ?? ''
  const workTime = parseTime(input.workTime, true, errors) ?? ''
  if (Object.keys(errors).length) throw new AppError(400, 'VALIDATION_ERROR', Object.values(errors)[0], errors)
  return { serviceId, packageId, workDate, workTime }
}

function parseUpdatePayload(input: Record<string, unknown>): UpdateBookingInput {
  const errors: Record<string, string> = {}
  const payload: UpdateBookingInput = {}
  if (Object.prototype.hasOwnProperty.call(input, 'serviceId') || Object.prototype.hasOwnProperty.call(input, 'providerId') || Object.prototype.hasOwnProperty.call(input, 'customerId') || Object.prototype.hasOwnProperty.call(input, 'status')) {
    throw new AppError(400, 'BOOKING_FIELD_FORBIDDEN', 'Identitas dan status booking tidak dapat diubah melalui endpoint ini.')
  }
  if (Object.prototype.hasOwnProperty.call(input, 'packageId')) {
    const raw = input.packageId
    if (raw === null || raw === '') payload.packageId = null
    else {
      const value = asString(raw).trim()
      if (!UUID_PATTERN.test(value)) errors.packageId = 'Format ID paket tidak valid.'
      else payload.packageId = value
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, 'workDate')) payload.workDate = parseDate(input.workDate, true, errors)
  if (Object.prototype.hasOwnProperty.call(input, 'workTime')) payload.workTime = parseTime(input.workTime, true, errors)
  if (Object.keys(errors).length) throw new AppError(400, 'VALIDATION_ERROR', Object.values(errors)[0], errors)
  if (!Object.keys(payload).length) throw new AppError(400, 'VALIDATION_ERROR', 'Minimal satu data booking harus diubah.')
  return payload
}

export const requireCustomer: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(new AppError(401, 'NO_SESSION', 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.'))
  if (req.auth.profile.role !== 'customer') return next(new AppError(403, 'FORBIDDEN', 'Hanya customer yang dapat melakukan aksi ini.'))
  return next()
}

export function createBookingRouter(authMiddleware: RequestHandler = requireAuth): Router {
  const router = Router()

  router.post('/bookings', authMiddleware, requireCustomer, asyncHandler(async (req, res) => {
    const payload = parseCreatePayload(body(req))
    const idempotencyKey = req.header('Idempotency-Key')?.trim()
    if (idempotencyKey && idempotencyKey.length > 100) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Idempotency-Key maksimal 100 karakter.')
    }
    const booking = await createBooking({ ...payload, idempotencyKey }, req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, { booking }, 201)
  }))

  router.get('/bookings/mine', authMiddleware, requireCustomer, asyncHandler(async (req, res) => {
    const bookings = await listCustomerBookings(req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, { bookings })
  }))

  router.get('/bookings/incoming', authMiddleware, requireProvider, asyncHandler(async (req, res) => {
    const bookings = await listProviderBookings(req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, { bookings })
  }))

  router.post('/bookings/:id/requirements/upload-url', authMiddleware, requireCustomer, asyncHandler(async (req, res) => {
    const input = body(req)
    const fileName = asString(input.fileName).trim()
    const contentType = asString(input.contentType).trim().toLowerCase()
    const fileSize = typeof input.size === 'number' ? input.size : 0
    const result = await createRequirementsUploadUrl(parseId(req.params.id), req.auth!.profile.id, req.auth!.accessToken, fileName, contentType, fileSize)
    sendSuccess(res, result)
  }))

  router.post('/bookings/:id/requirements', authMiddleware, requireCustomer, asyncHandler(async (req, res) => {
    const result = await createBookingRequirements(parseId(req.params.id), parseRequirementsPayload(body(req)), req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, { requirements: result }, 201)
  }))

  router.get('/bookings/:id/requirements', authMiddleware, asyncHandler(async (req, res) => {
    const result = await getBookingRequirements(parseId(req.params.id), req.auth!.profile.id, req.auth!.profile.role, req.auth!.accessToken)
    sendSuccess(res, { requirements: result })
  }))

  router.patch('/bookings/:id/requirements', authMiddleware, requireCustomer, asyncHandler(async (req, res) => {
    const result = await updateBookingRequirements(parseId(req.params.id), parseRequirementsPayload(body(req)), req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, { requirements: result })
  }))

  router.delete('/bookings/:id/requirements/attachments/:attachmentId', authMiddleware, requireCustomer, asyncHandler(async (req, res) => {
    const result = await deleteBookingRequirementAttachment(parseId(req.params.id), parseId(req.params.attachmentId), req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, result)
  }))

  router.delete('/bookings/:id/requirements', authMiddleware, requireCustomer, asyncHandler(async (req, res) => {
    const result = await deleteBookingRequirements(parseId(req.params.id), req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, result)
  }))

  router.get('/bookings/:id', authMiddleware, asyncHandler(async (req, res) => {
    const booking = await getBooking(parseId(req.params.id), req.auth!.accessToken)
    const user = req.auth!.profile
    if (user.role !== 'admin' && booking.customerId !== user.id && booking.providerId !== user.id) {
      throw new AppError(403, 'BOOKING_OWNERSHIP_FORBIDDEN', 'Kamu tidak memiliki akses ke booking ini.')
    }
    sendSuccess(res, { booking })
  }))

  router.patch('/bookings/:id', authMiddleware, requireCustomer, asyncHandler(async (req, res) => {
    const booking = await updateCustomerBooking(parseId(req.params.id), parseUpdatePayload(body(req)), req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, { booking })
  }))

  router.post('/bookings/:id/accept', authMiddleware, requireProvider, asyncHandler(async (req, res) => {
    const booking = await acceptBooking(parseId(req.params.id), req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, { booking })
  }))

  router.post('/bookings/:id/reject', authMiddleware, requireProvider, asyncHandler(async (req, res) => {
    const reason = asString(body(req).reason).trim()
    if (reason.length > 250) throw new AppError(400, 'VALIDATION_ERROR', 'Alasan penolakan maksimal 250 karakter.', { reason: 'Alasan penolakan maksimal 250 karakter.' })
    const booking = await rejectBooking(parseId(req.params.id), req.auth!.profile.id, req.auth!.accessToken, reason || undefined)
    sendSuccess(res, { booking })
  }))

  router.post('/bookings/:id/cancel', authMiddleware, requireCustomer, asyncHandler(async (req, res) => {
    const booking = await cancelBooking(parseId(req.params.id), req.auth!.profile.id, req.auth!.accessToken)
    sendSuccess(res, { booking })
  }))

  return router
}

export default createBookingRouter()
