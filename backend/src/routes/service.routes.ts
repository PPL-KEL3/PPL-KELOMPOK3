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
  updateServiceListing,
  type CreateServiceListingInput,
  type UpdateServiceListingInput,
} from '../services/service-listing.service'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requestBody(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>
}

function parseServiceId(rawId: unknown): string {
  const id = asString(rawId).trim()
  if (!id || !UUID_PATTERN.test(id)) {
    throw new AppError(400, 'INVALID_SERVICE_ID', 'Format ID layanan tidak valid.')
  }
  return id
}

function parseCreateServicePayload(
  body: Record<string, unknown>
): CreateServiceListingInput {
  const name = asString(body.name).trim().replace(/\s+/g, ' ')
  const categoryId = asString(body.categoryId).trim()
  const description = asString(body.description).trim()
  const rawPrice = Number(body.price)
  const isActive =
    typeof body.isActive === 'boolean' ? body.isActive : true

  return {
    name,
    categoryId,
    description,
    price: rawPrice,
    isActive,
  }
}

function parseUpdateServicePayload(
  body: Record<string, unknown>
): UpdateServiceListingInput {
  const payload: UpdateServiceListingInput = {}

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    payload.name = asString(body.name).trim().replace(/\s+/g, ' ')
  }

  if (Object.prototype.hasOwnProperty.call(body, 'categoryId')) {
    payload.categoryId = asString(body.categoryId).trim()
  }

  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    payload.description = asString(body.description).trim()
  }

  if (Object.prototype.hasOwnProperty.call(body, 'price')) {
    payload.price = Number(body.price)
  }

  if (Object.prototype.hasOwnProperty.call(body, 'isActive')) {
    payload.isActive = Boolean(body.isActive)
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
      const services = await listPublicServices(
        categoryId ? { categoryId } : undefined
      )
      sendSuccess(res, { services })
    })
  )

  router.get(
    '/services/mine',
    authMiddleware,
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
      const service = await updateServiceListing(id, payload, auth.accessToken)

      sendSuccess(res, {
        service,
        message: 'Layanan jasa berhasil diperbarui.',
      })
    })

  router.patch('/services/:id', authMiddleware, handleUpdateService())
  router.put('/services/:id', authMiddleware, handleUpdateService())

  router.delete(
    '/services/:id',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const auth = req.auth!
      const id = parseServiceId(req.params.id)
      const service = await deleteServiceListing(id, auth.accessToken)

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

