import { Router, type Request, type RequestHandler } from 'express'
import { AppError } from '../lib/errors'
import { asyncHandler, sendSuccess } from '../lib/http'
import { asString } from '../lib/validation'
import { requireAuth } from '../middleware/auth.middleware'
import {
  MAX_PORTFOLIO_FILE_SIZE,
  createPortfolioItem,
  createUploadUrl,
  deletePortfolioItem,
  discardUploadedFile,
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

const TITLE_MIN = 3
const TITLE_MAX = 100
const DESCRIPTION_MAX = 500
const FILE_NAME_MAX = 255
const IMAGE_PATH_MAX = 200

const EXTENSIONS_BY_CONTENT_TYPE: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
}

type Errors = Record<string, string>

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

function throwIfInvalid(errors: Errors): void {
  const keys = Object.keys(errors)
  if (keys.length === 0) return
  const first = errors.title ?? errors.description ?? errors.imagePath ?? errors[keys[0]]
  throw new AppError(400, 'VALIDATION_ERROR', first, errors)
}

function validateTitle(raw: unknown, errors: Errors): string {
  if (raw !== undefined && raw !== null && typeof raw !== 'string') {
    errors.title = 'Judul harus berupa teks.'
    return ''
  }
  const title = asString(raw).trim().replace(/\s+/g, ' ')
  if (!title) errors.title = 'Judul wajib diisi.'
  else if (title.length < TITLE_MIN) errors.title = `Judul minimal ${TITLE_MIN} karakter.`
  else if (title.length > TITLE_MAX) errors.title = `Judul maksimal ${TITLE_MAX} karakter.`
  return title
}

function validateDescription(raw: unknown, errors: Errors): string | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'string') {
    errors.description = 'Deskripsi harus berupa teks.'
    return null
  }
  const description = raw.trim()
  if (description.length > DESCRIPTION_MAX) {
    errors.description = `Deskripsi maksimal ${DESCRIPTION_MAX} karakter.`
  }
  return description || null
}

function validateImagePath(raw: unknown, errors: Errors): string {
  const imagePath = asString(raw).trim()
  if (!imagePath) errors.imagePath = 'Foto wajib dipilih.'
  else if (imagePath.length > IMAGE_PATH_MAX) errors.imagePath = 'Lokasi foto tidak valid.'
  return imagePath
}

/**
 * Metadata file dicek sebelum upload URL dibuat (lapis backend). Bucket mengecek lagi
 * saat file diunggah, dan service mengecek file aslinya saat item disimpan.
 */
function parseUploadUrlPayload(body: Record<string, unknown>): UploadUrlInput {
  const fileName = asString(body.fileName).trim()
  const contentType = asString(body.contentType).trim().toLowerCase()
  const size = body.size

  if (!fileName || fileName.length > FILE_NAME_MAX) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Nama file tidak valid.', {
      file: 'Nama file tidak valid.',
    })
  }

  const allowedExtensions = EXTENSIONS_BY_CONTENT_TYPE[contentType]
  const lowerName = fileName.toLowerCase()
  if (!allowedExtensions || !allowedExtensions.some((ext) => lowerName.endsWith(ext))) {
    throw new AppError(400, 'INVALID_FILE_TYPE', 'Format foto harus JPG atau PNG.', {
      file: 'Format foto harus JPG atau PNG.',
    })
  }

  if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Ukuran file tidak valid.', {
      file: 'Ukuran file tidak valid.',
    })
  }
  if (size > MAX_PORTFOLIO_FILE_SIZE) {
    throw new AppError(400, 'FILE_TOO_LARGE', 'Ukuran foto maksimal 5 MB.', {
      file: 'Ukuran foto maksimal 5 MB.',
    })
  }

  if (body.purpose === 'replace') {
    const portfolioId = parsePortfolioId(body.portfolioId)
    return { fileName, contentType, size, purpose: 'replace', portfolioId }
  }
  return { fileName, contentType, size, purpose: 'create' }
}

function parseCreatePayload(body: Record<string, unknown>): CreatePortfolioInput {
  const errors: Errors = {}
  const payload: CreatePortfolioInput = {
    title: validateTitle(body.title, errors),
    description: validateDescription(body.description, errors),
    imagePath: validateImagePath(body.imagePath, errors),
  }
  throwIfInvalid(errors)
  return payload
}

function parseUpdatePayload(body: Record<string, unknown>): UpdatePortfolioInput {
  const errors: Errors = {}
  const payload: UpdatePortfolioInput = {}

  if (has(body, 'providerId')) {
    errors.providerId = 'Portofolio tidak bisa dipindahkan ke penyedia lain.'
  }
  if (has(body, 'title')) payload.title = validateTitle(body.title, errors)
  if (has(body, 'description')) {
    payload.description = validateDescription(body.description, errors)
  }
  if (has(body, 'imagePath')) payload.imagePath = validateImagePath(body.imagePath, errors)

  if (Object.keys(payload).length === 0 && Object.keys(errors).length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Minimal satu data portofolio harus diisi untuk pembaruan.'
    )
  }
  throwIfInvalid(errors)
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
      const body = requestBody(req)
      let payload: CreatePortfolioInput
      try {
        payload = parseCreatePayload(body)
      } catch (error) {
        // Foto sudah terunggah sebelum Simpan diproses: jangan tinggalkan file yatim.
        await discardUploadedFile(
          asString(body.imagePath).trim(),
          req.auth!.profile.id,
          req.auth!.accessToken
        )
        throw error
      }
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
      const body = requestBody(req)
      let id: string
      let payload: UpdatePortfolioInput
      try {
        id = parsePortfolioId(req.params.id)
        payload = parseUpdatePayload(body)
      } catch (error) {
        if (has(body, 'imagePath')) {
          await discardUploadedFile(
            asString(body.imagePath).trim(),
            req.auth!.profile.id,
            req.auth!.accessToken
          )
        }
        throw error
      }
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
