import { Router, type Request, type RequestHandler } from 'express'
import { AppError } from '../lib/errors'
import { asyncHandler, sendSuccess } from '../lib/http'
import { asString } from '../lib/validation'
import { requireAuth } from '../middleware/auth.middleware'
import {
  createPackage,
  deletePackage,
  listProviderPackages,
  listPublicPackages,
  updatePackage,
  type CreatePackageInput,
  type UpdatePackageInput,
} from '../services/package.service'
import { requireProvider } from './service.routes'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requestBody(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>
}

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key)
}

function parseUuid(raw: unknown, code: string, message: string): string {
  const id = asString(raw).trim()
  if (!id || !UUID_PATTERN.test(id)) throw new AppError(400, code, message)
  return id
}

const parseServiceId = (raw: unknown) =>
  parseUuid(raw, 'INVALID_SERVICE_ID', 'Format ID jasa tidak valid.')

const parsePackageId = (raw: unknown) =>
  parseUuid(raw, 'INVALID_PACKAGE_ID', 'Format ID paket tidak valid.')

const NAME_MIN = 3
const NAME_MAX = 100
const DESCRIPTION_MAX = 500
const PRICE_MIN = 1000
const PRICE_MAX = 100000000

type Errors = Record<string, string>

function validateName(raw: unknown, errors: Errors): string {
  const name = asString(raw).trim().replace(/\s+/g, ' ')
  if (!name) errors.name = 'Nama paket wajib diisi.'
  else if (name.length < NAME_MIN) errors.name = `Nama paket minimal ${NAME_MIN} karakter.`
  else if (name.length > NAME_MAX) errors.name = `Nama paket maksimal ${NAME_MAX} karakter.`
  return name
}

function validateDescription(raw: unknown, errors: Errors): string | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'string') {
    errors.description = 'Deskripsi paket harus berupa teks.'
    return null
  }
  const description = raw.trim()
  if (description.length > DESCRIPTION_MAX) {
    errors.description = `Deskripsi maksimal ${DESCRIPTION_MAX} karakter.`
  }
  return description || null
}

function validatePrice(raw: unknown, errors: Errors): number {
  if (raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim())) {
    errors.price = 'Harga paket wajib diisi.'
    return 0
  }
  const price =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && /^\d[\d.\s]*$/.test(raw.trim())
        ? Number(raw.trim().replace(/[.\s]/g, ''))
        : Number.NaN
  if (!Number.isInteger(price)) {
    errors.price = 'Harga harus berupa angka bulat dalam Rupiah.'
  } else if (price < PRICE_MIN) {
    errors.price = 'Harga minimal Rp 1.000.'
  } else if (price > PRICE_MAX) {
    errors.price = 'Harga maksimal Rp 100.000.000.'
  }
  return price
}

function validateIsActive(raw: unknown, errors: Errors): boolean {
  if (typeof raw !== 'boolean') {
    errors.isActive = 'Status paket harus berupa nilai boolean.'
    return true
  }
  return raw
}

function throwIfInvalid(errors: Errors): void {
  const keys = Object.keys(errors)
  if (keys.length === 0) return
  const first =
    errors.serviceId ?? errors.name ?? errors.price ?? errors.description ?? errors[keys[0]]
  throw new AppError(400, 'VALIDATION_ERROR', first, errors)
}

function parseCreatePayload(body: Record<string, unknown>): CreatePackageInput {
  const errors: Errors = {}
  const serviceId = asString(body.serviceId).trim()
  if (!serviceId) errors.serviceId = 'Jasa wajib dipilih.'
  else if (!UUID_PATTERN.test(serviceId)) errors.serviceId = 'Format ID jasa tidak valid.'

  const payload: CreatePackageInput = {
    serviceId,
    name: validateName(body.name, errors),
    description: validateDescription(body.description, errors),
    price: validatePrice(body.price, errors),
    isActive: has(body, 'isActive') ? validateIsActive(body.isActive, errors) : true,
  }
  throwIfInvalid(errors)
  return payload
}

function parseUpdatePayload(body: Record<string, unknown>): UpdatePackageInput {
  const errors: Errors = {}
  const payload: UpdatePackageInput = {}

  if (has(body, 'serviceId')) {
    errors.serviceId = 'Paket tidak bisa dipindahkan ke jasa lain.'
  }
  if (has(body, 'name')) payload.name = validateName(body.name, errors)
  if (has(body, 'description')) {
    payload.description = validateDescription(body.description, errors)
  }
  if (has(body, 'price')) payload.price = validatePrice(body.price, errors)
  if (has(body, 'isActive')) payload.isActive = validateIsActive(body.isActive, errors)

  if (Object.keys(payload).length === 0 && Object.keys(errors).length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Minimal satu data paket harus diisi untuk pembaruan.'
    )
  }
  throwIfInvalid(errors)
  return payload
}

export function createPackageRouter(
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router()

  router.get(
    '/services/:serviceId/packages',
    asyncHandler(async (req, res) => {
      const serviceId = parseServiceId(req.params.serviceId)
      const packages = await listPublicPackages(serviceId)
      sendSuccess(res, { packages })
    })
  )

  router.get(
    '/packages/mine',
    authMiddleware,
    requireProvider,
    asyncHandler(async (req, res) => {
      const serviceId = parseServiceId(req.query.serviceId)
      const packages = await listProviderPackages(
        serviceId,
        req.auth!.profile.id,
        req.auth!.accessToken
      )
      sendSuccess(res, { packages })
    })
  )

  router.post(
    '/packages',
    authMiddleware,
    requireProvider,
    asyncHandler(async (req, res) => {
      const payload = parseCreatePayload(requestBody(req))
      const pkg = await createPackage(payload, req.auth!.profile.id, req.auth!.accessToken)
      sendSuccess(
        res,
        { package: pkg, message: `Paket "${pkg.name}" berhasil ditambahkan.` },
        201
      )
    })
  )

  router.patch(
    '/packages/:id',
    authMiddleware,
    requireProvider,
    asyncHandler(async (req, res) => {
      const id = parsePackageId(req.params.id)
      const payload = parseUpdatePayload(requestBody(req))
      const pkg = await updatePackage(
        id,
        payload,
        req.auth!.profile.id,
        req.auth!.accessToken
      )
      sendSuccess(res, { package: pkg, message: `Paket "${pkg.name}" diperbarui.` })
    })
  )

  router.delete(
    '/packages/:id',
    authMiddleware,
    requireProvider,
    asyncHandler(async (req, res) => {
      const id = parsePackageId(req.params.id)
      const pkg = await deletePackage(id, req.auth!.profile.id, req.auth!.accessToken)
      sendSuccess(res, {
        package: pkg,
        deletedId: pkg.id,
        message: `Paket "${pkg.name}" dihapus.`,
      })
    })
  )

  return router
}

export default createPackageRouter()
