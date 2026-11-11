import { Router, type Request, type RequestHandler } from 'express'
import { AppError } from '../lib/errors'
import { asyncHandler, sendSuccess } from '../lib/http'
import { asString } from '../lib/validation'
import { requireAuth } from '../middleware/auth.middleware'
import {
  createPortfolioItem,
  createUploadUrl,
  deletePortfolioItem,
  listProviderPortfolio,
  listPublicPortfolio,
  updatePortfolioItem,
  type CreatePortfolioInput,
  type UpdatePortfolioInput,
  type UploadUrlInput,
} from '../services/portfolio.service'
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
  return id.toLowerCase()
}

const parseProviderId = (raw: unknown) =>
  parseUuid(raw, 'INVALID_PROVIDER_ID', 'Format ID penyedia tidak valid.')

const parsePortfolioId = (raw: unknown) =>
  parseUuid(raw, 'INVALID_PORTFOLIO_ID', 'Format ID portofolio tidak valid.')

function parseDescription(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  return raw.trim() || null
}

function parseUploadUrlPayload(body: Record<string, unknown>): UploadUrlInput {
  return {
    fileName: asString(body.fileName).trim(),
    contentType: asString(body.contentType).trim().toLowerCase(),
    size: typeof body.size === 'number' ? body.size : Number.NaN,
  }
}

function parseCreatePayload(body: Record<string, unknown>): CreatePortfolioInput {
  return {
    title: asString(body.title).trim().replace(/\s+/g, ' '),
    description: parseDescription(body.description),
    imagePath: asString(body.imagePath).trim(),
  }
}

function parseUpdatePayload(body: Record<string, unknown>): UpdatePortfolioInput {
  const payload: UpdatePortfolioInput = {}
  if (has(body, 'title')) payload.title = asString(body.title).trim().replace(/\s+/g, ' ')
  if (has(body, 'description')) payload.description = parseDescription(body.description)
  if (has(body, 'imagePath')) payload.imagePath = asString(body.imagePath).trim()

  if (Object.keys(payload).length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Minimal satu data portofolio harus diisi untuk pembaruan.'
    )
  }
  return payload
}

export function createPortfolioRouter(
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router()

  // Route `/providers/me/...` didaftarkan sebelum `/providers/:id/portfolio`
  // supaya `me` tidak terbaca sebagai ID penyedia.
  router.get(
    '/providers/me/portfolio',
    authMiddleware,
    requireProvider,
    asyncHandler(async (req, res) => {
      const result = await listProviderPortfolio(
        req.auth!.profile.id,
        req.auth!.accessToken
      )
      sendSuccess(res, result)
    })
  )

  router.post(
    '/providers/me/portfolio/upload-url',
    authMiddleware,
    requireProvider,
    asyncHandler(async (req, res) => {
      const payload = parseUploadUrlPayload(requestBody(req))
      const result = await createUploadUrl(
        payload,
        req.auth!.profile.id,
        req.auth!.accessToken
      )
      sendSuccess(res, result)
    })
  )

  router.post(
    '/providers/me/portfolio',
    authMiddleware,
    requireProvider,
    asyncHandler(async (req, res) => {
      const payload = parseCreatePayload(requestBody(req))
      const item = await createPortfolioItem(
        payload,
        req.auth!.profile.id,
        req.auth!.accessToken
      )
      sendSuccess(
        res,
        { item, message: 'Portofolio baru berhasil ditambahkan.' },
        201
      )
    })
  )

  router.patch(
    '/providers/me/portfolio/:id',
    authMiddleware,
    requireProvider,
    asyncHandler(async (req, res) => {
      const id = parsePortfolioId(req.params.id)
      const payload = parseUpdatePayload(requestBody(req))
      const item = await updatePortfolioItem(
        id,
        payload,
        req.auth!.profile.id,
        req.auth!.accessToken
      )
      sendSuccess(res, { item, message: 'Portofolio berhasil diperbarui.' })
    })
  )

  router.delete(
    '/providers/me/portfolio/:id',
    authMiddleware,
    requireProvider,
    asyncHandler(async (req, res) => {
      const id = parsePortfolioId(req.params.id)
      const { item, fileCleanupFailed } = await deletePortfolioItem(
        id,
        req.auth!.profile.id,
        req.auth!.accessToken
      )
      sendSuccess(res, {
        deletedId: item.id,
        fileCleanupFailed,
        message: fileCleanupFailed
          ? 'Item terhapus, file masih tertinggal.'
          : 'Portofolio berhasil dihapus.',
      })
    })
  )

  router.get(
    '/providers/:id/portfolio',
    asyncHandler(async (req, res) => {
      const providerId = parseProviderId(req.params.id)
      const items = await listPublicPortfolio(providerId)
      sendSuccess(res, { items })
    })
  )

  return router
}

export default createPortfolioRouter()
