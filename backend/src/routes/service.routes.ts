import {
  Router,
  type Request,
  type RequestHandler,
} from 'express'
import { AppError } from '../lib/errors'
import { asyncHandler, sendSuccess } from '../lib/http'
import { asString } from '../lib/validation'
import { requireAuth } from '../middleware/auth.middleware'
import {
  createServiceListing,
  deleteServiceListing,
  getServiceListingById,
  listProviderServices,
  listPublicServices,
  normalizeServiceName,
  updateServiceListing,
  type CreateServiceListingInput,
  type UpdateServiceListingInput,
} from '../services/service-listing.service'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MIN_SERVICE_NAME_LENGTH = 3
const MAX_SERVICE_NAME_LENGTH = 100
const MIN_SERVICE_DESCRIPTION_LENGTH = 10
const MAX_SERVICE_DESCRIPTION_LENGTH = 500
const MIN_SERVICE_PRICE = 1000
const MAX_SERVICE_PRICE = 100000000

function requestBody(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>
}

export const requireProvider: RequestHandler = (req, _res, next) => {
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
        'Kamu tidak memiliki izin untuk mengakses fitur penyedia jasa.'
      )
    )
  }

  return next()
}

export const requireVerifiedProvider: RequestHandler = (req, _res, next) => {
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
        'Kamu tidak memiliki izin untuk mengakses fitur penyedia jasa.'
      )
    )
  }

  if (req.auth.profile.providerVerificationStatus !== 'verified') {
    return next(
      new AppError(
        403,
        'PROVIDER_NOT_VERIFIED',
        'Akun penyedia jasa kamu belum terverifikasi. Selesaikan verifikasi terlebih dahulu untuk mengelola layanan.'
      )
    )
  }

  return next()
}

function parseServiceId(rawId: unknown): string {
  const id = asString(rawId).trim()
  if (!id || !UUID_PATTERN.test(id)) {
    throw new AppError(400, 'INVALID_SERVICE_ID', 'Format ID layanan tidak valid.')
  }
  return id
}

function validateServiceName(
  rawName: unknown,
  errors: Record<string, string>
): string {
  const name = normalizeServiceName(asString(rawName))

  if (!name) {
    errors.name = 'Nama layanan jasa wajib diisi.'
  } else if (name.length < MIN_SERVICE_NAME_LENGTH) {
    errors.name = `Nama layanan minimal terdiri dari ${MIN_SERVICE_NAME_LENGTH} karakter.`
  } else if (name.length > MAX_SERVICE_NAME_LENGTH) {
    errors.name = `Nama layanan maksimal ${MAX_SERVICE_NAME_LENGTH} karakter.`
  }

  return name
}

function validateServiceCategoryId(
  rawCategoryId: unknown,
  errors: Record<string, string>
): string {
  const categoryId = asString(rawCategoryId).trim()

  if (!categoryId) {
    errors.categoryId = 'Kategori layanan wajib dipilih.'
  } else if (!UUID_PATTERN.test(categoryId)) {
    errors.categoryId = 'Format ID kategori layanan tidak valid.'
  }

  return categoryId
}

function validateServiceDescription(
  rawDescription: unknown,
  errors: Record<string, string>
): string {
  const description = asString(rawDescription).trim()

  if (!description) {
    errors.description = 'Deskripsi layanan wajib diisi.'
  } else if (description.length < MIN_SERVICE_DESCRIPTION_LENGTH) {
    errors.description = `Deskripsi layanan minimal terdiri dari ${MIN_SERVICE_DESCRIPTION_LENGTH} karakter.`
  } else if (description.length > MAX_SERVICE_DESCRIPTION_LENGTH) {
    errors.description = `Deskripsi layanan maksimal ${MAX_SERVICE_DESCRIPTION_LENGTH} karakter.`
  }

  return description
}

function validateServicePrice(
  rawPrice: unknown,
  errors: Record<string, string>
): number {
  if (
    rawPrice === undefined ||
    rawPrice === null ||
    (typeof rawPrice === 'string' && rawPrice.trim() === '')
  ) {
    errors.price = 'Harga layanan wajib diisi.'
    return 0
  }

  const parsedPrice =
    typeof rawPrice === 'number'
      ? rawPrice
      : Number(String(rawPrice).trim().replace(/[.\s]/g, ''))

  if (!Number.isFinite(parsedPrice) || !Number.isInteger(parsedPrice)) {
    errors.price = 'Harga layanan harus berupa angka bulat dalam Rupiah.'
    return 0
  }

  if (parsedPrice < MIN_SERVICE_PRICE) {
    errors.price = 'Harga layanan minimal Rp 1.000.'
  } else if (parsedPrice > MAX_SERVICE_PRICE) {
    errors.price = 'Harga layanan maksimal Rp 100.000.000.'
  }

  return parsedPrice
}

function validateServiceIsActive(
  rawIsActive: unknown,
  errors: Record<string, string>
): boolean {
  if (typeof rawIsActive !== 'boolean') {
    errors.isActive = 'Status publikasi layanan harus berupa nilai boolean.'
    return true
  }
  return rawIsActive
}

function parseCreateServicePayload(
  body: Record<string, unknown>
): CreateServiceListingInput {
  const errors: Record<string, string> = {}

  const name = validateServiceName(body.name, errors)
  const categoryId = validateServiceCategoryId(body.categoryId, errors)
  const description = validateServiceDescription(body.description, errors)
  const price = validateServicePrice(body.price, errors)

  let isActive = true
  if (Object.prototype.hasOwnProperty.call(body, 'isActive')) {
    isActive = validateServiceIsActive(body.isActive, errors)
  }

  if (Object.keys(errors).length > 0) {
    const firstMessage =
      errors.name ??
      errors.categoryId ??
      errors.description ??
      errors.price ??
      errors.isActive ??
      'Data layanan tidak valid.'
    throw new AppError(400, 'VALIDATION_ERROR', firstMessage, errors)
  }

  return {
    name,
    categoryId,
    description,
    price,
    isActive,
  }
}

function parseUpdateServicePayload(
  body: Record<string, unknown>
): UpdateServiceListingInput {
  const hasName = Object.prototype.hasOwnProperty.call(body, 'name')
  const hasCategoryId = Object.prototype.hasOwnProperty.call(body, 'categoryId')
  const hasDescription = Object.prototype.hasOwnProperty.call(
    body,
    'description'
  )
  const hasPrice = Object.prototype.hasOwnProperty.call(body, 'price')
  const hasIsActive = Object.prototype.hasOwnProperty.call(body, 'isActive')

  if (
    !hasName &&
    !hasCategoryId &&
    !hasDescription &&
    !hasPrice &&
    !hasIsActive
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Minimal satu data layanan harus diisi untuk pembaruan.'
    )
  }

  const errors: Record<string, string> = {}
  const payload: UpdateServiceListingInput = {}

  if (hasName) {
    payload.name = validateServiceName(body.name, errors)
  }

  if (hasCategoryId) {
    payload.categoryId = validateServiceCategoryId(body.categoryId, errors)
  }

  if (hasDescription) {
    payload.description = validateServiceDescription(body.description, errors)
  }

  if (hasPrice) {
    payload.price = validateServicePrice(body.price, errors)
  }

  if (hasIsActive) {
    payload.isActive = validateServiceIsActive(body.isActive, errors)
  }

  if (Object.keys(errors).length > 0) {
    const firstMessage =
      errors.name ??
      errors.categoryId ??
      errors.description ??
      errors.price ??
      errors.isActive ??
      'Data layanan tidak valid.'
    throw new AppError(400, 'VALIDATION_ERROR', firstMessage, errors)
  }

  return payload
}

export function createServiceRouter(
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router()

  router.get(
    '/services',
    asyncHandler(async (req, res) => {
      const categoryId = asString(req.query.categoryId).trim()
      if (categoryId && !UUID_PATTERN.test(categoryId)) {
        throw new AppError(
          400,
          'INVALID_CATEGORY_ID',
          'Format ID kategori filter tidak valid.'
        )
      }

      const services = await listPublicServices(
        categoryId ? { categoryId } : undefined
      )
      sendSuccess(res, { services })
    })
  )

  router.get(
    '/services/mine',
    authMiddleware,
    requireProvider,
    asyncHandler(async (req, res) => {
      const auth = req.auth!
      const services = await listProviderServices(
        auth.profile.id,
        auth.accessToken
      )
      sendSuccess(res, { services })
    })
  )

  router.get(
    '/services/:id',
    asyncHandler(async (req, res) => {
      const id = parseServiceId(req.params.id)
      const service = await getServiceListingById(id)
      sendSuccess(res, { service })
    })
  )

  router.post(
    '/services',
    authMiddleware,
    requireVerifiedProvider,
    asyncHandler(async (req, res) => {
      const auth = req.auth!
      const payload = parseCreateServicePayload(requestBody(req))
      const service = await createServiceListing(
        auth.profile.id,
        auth.profile.fullName,
        payload,
        auth.accessToken
      )

      sendSuccess(
        res,
        {
          service,
          message: 'Layanan jasa berhasil ditambahkan.',
        },
        201
      )
    })
  )

  const handleUpdateService = () =>
    asyncHandler(async (req, res) => {
      const auth = req.auth!
      const id = parseServiceId(req.params.id)
      const payload = parseUpdateServicePayload(requestBody(req))
      const service = await updateServiceListing(
        id,
        auth.profile.id,
        payload,
        auth.accessToken
      )

      sendSuccess(res, {
        service,
        message: 'Layanan jasa berhasil diperbarui.',
      })
    })

  router.patch(
    '/services/:id',
    authMiddleware,
    requireVerifiedProvider,
    handleUpdateService()
  )
  router.put(
    '/services/:id',
    authMiddleware,
    requireVerifiedProvider,
    handleUpdateService()
  )

  router.delete(
    '/services/:id',
    authMiddleware,
    requireVerifiedProvider,
    asyncHandler(async (req, res) => {
      const auth = req.auth!
      const id = parseServiceId(req.params.id)
      const service = await deleteServiceListing(
        id,
        auth.profile.id,
        auth.accessToken
      )

      sendSuccess(res, {
        service,
        deletedId: service.id,
        message: 'Layanan jasa berhasil dihapus.',
      })
    })
  )

  return router
}

export default createServiceRouter()

