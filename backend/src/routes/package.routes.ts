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

function parseDescription(raw: unknown): string | null {
  const description = asString(raw).trim()
  return description ? description : null
}

// Validasi aturan bisnis lengkap (panjang, rentang harga, batas 10 paket) ditambahkan di TPR-43.
function parseCreatePayload(body: Record<string, unknown>): CreatePackageInput {
  return {
    serviceId: parseServiceId(body.serviceId),
    name: asString(body.name).trim().replace(/\s+/g, ' '),
    description: parseDescription(body.description),
    price: typeof body.price === 'number' ? body.price : Number.NaN,
    isActive: has(body, 'isActive') ? body.isActive === true : true,
  }
}

function parseUpdatePayload(body: Record<string, unknown>): UpdatePackageInput {
  const payload: UpdatePackageInput = {}
  if (has(body, 'name')) payload.name = asString(body.name).trim().replace(/\s+/g, ' ')
  if (has(body, 'description')) payload.description = parseDescription(body.description)
  if (has(body, 'price')) {
    payload.price = typeof body.price === 'number' ? body.price : Number.NaN
  }
  if (has(body, 'isActive')) payload.isActive = body.isActive === true

  if (Object.keys(payload).length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Minimal satu data paket harus diisi untuk pembaruan.'
    )
  }
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
      const packages = await listProviderPackages(serviceId, req.auth!.accessToken)
      sendSuccess(res, { packages })
    })
  )

  router.post(
    '/packages',
    authMiddleware,
    requireProvider,
    asyncHandler(async (req, res) => {
      const payload = parseCreatePayload(requestBody(req))
      const pkg = await createPackage(payload, req.auth!.accessToken)
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
      const pkg = await updatePackage(id, payload, req.auth!.accessToken)
      sendSuccess(res, { package: pkg, message: `Paket "${pkg.name}" diperbarui.` })
    })
  )

  router.delete(
    '/packages/:id',
    authMiddleware,
    requireProvider,
    asyncHandler(async (req, res) => {
      const id = parsePackageId(req.params.id)
      const pkg = await deletePackage(id, req.auth!.accessToken)
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
