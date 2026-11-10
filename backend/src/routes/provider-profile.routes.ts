import { Router, type Request, type RequestHandler } from 'express'
import { AppError } from '../lib/errors'
import { asyncHandler, sendSuccess } from '../lib/http'
import { asString } from '../lib/validation'
import { requireAuth } from '../middleware/auth.middleware'
import { listPublicServices } from '../services/service-listing.service'
import {
  getMyProviderProfile,
  getPublicProviderProfile,
  isValidWhatsAppNumber,
  normalizeBusinessName,
  normalizeOperatingHours,
  normalizeWhatsAppNumber,
  updateMyProviderProfile,
  upsertMyProviderProfile,
  validateOperatingHours,
  type OperatingHours,
  type ProviderProfileUpdateInput,
  type ProviderProfileWriteInput,
} from '../services/provider-profile.service'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MIN_BUSINESS_NAME_LENGTH = 2
const MAX_BUSINESS_NAME_LENGTH = 80
const MAX_BIO_LENGTH = 500
const MIN_ADDRESS_LENGTH = 5
const MAX_ADDRESS_LENGTH = 255
const MIN_SERVICE_AREA_LENGTH = 3
const MAX_SERVICE_AREA_LENGTH = 100

function requestBody(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>
}

function hasOwn(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key)
}

function validationError(fields: Record<string, string>): AppError {
  const firstMessage =
    fields.businessName ??
    fields.whatsappNumber ??
    fields.address ??
    fields.serviceArea ??
    fields.operatingHours ??
    fields.primaryCategoryId ??
    fields.bio ??
    fields.isPublic ??
    'Periksa kembali data profil penyedia yang dimasukkan.'

  return new AppError(400, 'VALIDATION_ERROR', firstMessage, fields)
}

const requireProviderRole: RequestHandler = (req, _res, next) => {
  if (!req.auth) {
    return next(
      new AppError(
        401,
        'NO_SESSION',
        'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.'
      )
    )
  }

  if (req.auth.profile.role !== 'provider') {
    return next(
      new AppError(
        403,
        'FORBIDDEN',
        'Hanya akun penyedia jasa yang dapat mengelola profil penyedia.'
      )
    )
  }

  return next()
}

function parseProviderId(rawId: unknown): string {
  const id = asString(rawId).trim()
  if (!id || !UUID_PATTERN.test(id)) {
    throw new AppError(
      400,
      'INVALID_PROVIDER_ID',
      'Format ID penyedia tidak valid.'
    )
  }
  return id
}

function validateBusinessName(
  raw: unknown,
  errors: Record<string, string>
): string {
  const name = normalizeBusinessName(asString(raw))

  if (!name) {
    errors.businessName = 'Nama usaha wajib diisi.'
  } else if (name.length < MIN_BUSINESS_NAME_LENGTH) {
    errors.businessName = `Nama usaha minimal terdiri dari ${MIN_BUSINESS_NAME_LENGTH} karakter.`
  } else if (name.length > MAX_BUSINESS_NAME_LENGTH) {
    errors.businessName = `Nama usaha maksimal ${MAX_BUSINESS_NAME_LENGTH} karakter.`
  }

  return name
}

function validateBio(raw: unknown, errors: Record<string, string>): string | null {
  if (raw === undefined || raw === null) return null

  if (typeof raw !== 'string') {
    errors.bio = 'Bio usaha harus berupa teks.'
    return null
  }

  const bio = raw.trim()
  if (!bio) return null

  if (bio.length > MAX_BIO_LENGTH) {
    errors.bio = `Bio usaha maksimal ${MAX_BIO_LENGTH} karakter.`
  }

  return bio
}

function validateWhatsApp(
  raw: unknown,
  errors: Record<string, string>
): string {
  const rawValue = asString(raw).trim()
  const normalized = normalizeWhatsAppNumber(rawValue)

  if (!rawValue) {
    errors.whatsappNumber = 'Nomor WhatsApp wajib diisi.'
  } else if (!isValidWhatsAppNumber(normalized)) {
    errors.whatsappNumber =
      'Masukkan nomor WhatsApp Indonesia yang valid, contoh 081234567890.'
  }

  return normalized
}

function validateAddress(
  raw: unknown,
  errors: Record<string, string>
): string {
  const address = asString(raw).trim()

  if (!address) {
    errors.address = 'Alamat lengkap wajib diisi.'
  } else if (address.length < MIN_ADDRESS_LENGTH) {
    errors.address = `Alamat lengkap minimal terdiri dari ${MIN_ADDRESS_LENGTH} karakter.`
  } else if (address.length > MAX_ADDRESS_LENGTH) {
    errors.address = `Alamat lengkap maksimal ${MAX_ADDRESS_LENGTH} karakter.`
  }

  return address
}

function validateServiceArea(
  raw: unknown,
  errors: Record<string, string>
): string {
  const serviceArea = asString(raw).trim()

  if (!serviceArea) {
    errors.serviceArea = 'Area layanan wajib diisi.'
  } else if (serviceArea.length < MIN_SERVICE_AREA_LENGTH) {
    errors.serviceArea = `Area layanan minimal terdiri dari ${MIN_SERVICE_AREA_LENGTH} karakter.`
  } else if (serviceArea.length > MAX_SERVICE_AREA_LENGTH) {
    errors.serviceArea = `Area layanan maksimal ${MAX_SERVICE_AREA_LENGTH} karakter.`
  }

  return serviceArea
}

function validatePrimaryCategoryId(
  raw: unknown,
  errors: Record<string, string>
): string {
  const categoryId = asString(raw).trim()

  if (!categoryId) {
    errors.primaryCategoryId = 'Kategori utama wajib dipilih.'
  } else if (!UUID_PATTERN.test(categoryId)) {
    errors.primaryCategoryId = 'Format ID kategori utama tidak valid.'
  }

  return categoryId
}

function validateIsPublic(
  raw: unknown,
  errors: Record<string, string>
): boolean {
  if (typeof raw !== 'boolean') {
    errors.isPublic = 'Status publikasi profil harus berupa nilai boolean.'
    return false
  }

  return raw
}

function parseCreatePayload(body: Record<string, unknown>): ProviderProfileWriteInput {
  const errors: Record<string, string> = {}

  const businessName = validateBusinessName(body.businessName, errors)
  const bio = validateBio(body.bio, errors)
  const whatsappNumber = validateWhatsApp(body.whatsappNumber, errors)
  const address = validateAddress(body.address, errors)
  const serviceArea = validateServiceArea(body.serviceArea, errors)
  const primaryCategoryId = validatePrimaryCategoryId(
    body.primaryCategoryId,
    errors
  )

  const operatingHoursError = validateOperatingHours(body.operatingHours)
  if (operatingHoursError) {
    errors.operatingHours = operatingHoursError
  }

  const isPublic = hasOwn(body, 'isPublic')
    ? validateIsPublic(body.isPublic, errors)
    : false

  if (Object.keys(errors).length > 0) {
    throw validationError(errors)
  }

  return {
    businessName,
    bio,
    whatsappNumber,
    address,
    serviceArea,
    operatingHours: normalizeOperatingHours(body.operatingHours),
    primaryCategoryId,
    isPublic,
  }
}

function parseUpdatePayload(
  body: Record<string, unknown>
): ProviderProfileUpdateInput {
  const hasBusinessName = hasOwn(body, 'businessName')
  const hasBio = hasOwn(body, 'bio')
  const hasWhatsApp = hasOwn(body, 'whatsappNumber')
  const hasAddress = hasOwn(body, 'address')
  const hasServiceArea = hasOwn(body, 'serviceArea')
  const hasOperatingHours = hasOwn(body, 'operatingHours')
  const hasPrimaryCategoryId = hasOwn(body, 'primaryCategoryId')
  const hasIsPublic = hasOwn(body, 'isPublic')

  if (
    !hasBusinessName &&
    !hasBio &&
    !hasWhatsApp &&
    !hasAddress &&
    !hasServiceArea &&
    !hasOperatingHours &&
    !hasPrimaryCategoryId &&
    !hasIsPublic
  ) {
    throw validationError({
      businessName: 'Minimal satu data profil harus diisi untuk pembaruan.',
    })
  }

  const errors: Record<string, string> = {}
  const payload: ProviderProfileUpdateInput = {}

  if (hasBusinessName) {
    payload.businessName = validateBusinessName(body.businessName, errors)
  }

  if (hasBio) {
    payload.bio = validateBio(body.bio, errors)
  }

  if (hasWhatsApp) {
    payload.whatsappNumber = validateWhatsApp(body.whatsappNumber, errors)
  }

  if (hasAddress) {
    payload.address = validateAddress(body.address, errors)
  }

  if (hasServiceArea) {
    payload.serviceArea = validateServiceArea(body.serviceArea, errors)
  }

  if (hasOperatingHours) {
    const operatingHoursError = validateOperatingHours(body.operatingHours)
    if (operatingHoursError) {
      errors.operatingHours = operatingHoursError
    } else {
      payload.operatingHours = normalizeOperatingHours(
        body.operatingHours
      ) as OperatingHours
    }
  }

  if (hasPrimaryCategoryId) {
    payload.primaryCategoryId = validatePrimaryCategoryId(
      body.primaryCategoryId,
      errors
    )
  }

  if (hasIsPublic) {
    payload.isPublic = validateIsPublic(body.isPublic, errors)
  }

  if (Object.keys(errors).length > 0) {
    throw validationError(errors)
  }

  return payload
}

export function createProviderProfileRouter(
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router()

  router.get(
    '/providers/me',
    authMiddleware,
    requireProviderRole,
    asyncHandler(async (req, res) => {
      const auth = req.auth!
      const profile = await getMyProviderProfile(
        auth.profile.id,
        auth.accessToken
      )

      sendSuccess(res, { profile })
    })
  )

  router.put(
    '/providers/me',
    authMiddleware,
    requireProviderRole,
    asyncHandler(async (req, res) => {
      const auth = req.auth!
      const payload = parseCreatePayload(requestBody(req))
      const profile = await upsertMyProviderProfile(
        auth.profile.id,
        payload,
        auth.accessToken
      )

      sendSuccess(res, {
        profile,
        message: 'Profil penyedia berhasil disimpan.',
      })
    })
  )

  router.patch(
    '/providers/me',
    authMiddleware,
    requireProviderRole,
    asyncHandler(async (req, res) => {
      const auth = req.auth!
      const payload = parseUpdatePayload(requestBody(req))
      const profile = await updateMyProviderProfile(
        auth.profile.id,
        payload,
        auth.accessToken
      )

      sendSuccess(res, {
        profile,
        message: 'Profil penyedia berhasil diperbarui.',
      })
    })
  )

  router.get(
    '/providers/:id',
    asyncHandler(async (req, res) => {
      const id = parseProviderId(req.params.id)
      const provider = await getPublicProviderProfile(id)
      const services = await listPublicServices({ providerId: id })

      sendSuccess(res, { provider, services })
    })
  )

  return router
}

export default createProviderProfileRouter()
