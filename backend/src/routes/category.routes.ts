import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express'
import { AppError } from '../lib/errors'
import { asyncHandler, sendSuccess } from '../lib/http'
import { asString } from '../lib/validation'
import { requireAuth } from '../middleware/auth.middleware'
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  updateCategory,
  type UpdateCategoryInput,
} from '../services/category.service'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MIN_CATEGORY_NAME_LENGTH = 2
const MAX_CATEGORY_NAME_LENGTH = 80
const MAX_CATEGORY_DESCRIPTION_LENGTH = 350

function requestBody(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>
}

function validationError(fields: Record<string, string>): AppError {
  return new AppError(
    400,
    'VALIDATION_ERROR',
    'Periksa kembali data kategori yang dimasukkan.',
    fields
  )
}

function parseCategoryId(rawId: unknown): string {
  const id = asString(rawId).trim()
  if (!id || !UUID_PATTERN.test(id)) {
    throw new AppError(400, 'INVALID_CATEGORY_ID', 'Format ID kategori tidak valid.')
  }
  return id
}

function parseCreatePayload(body: Record<string, unknown>): {
  name: string
  description: string | null
} {
  const fields: Record<string, string> = {}

  const name = asString(body.name).trim()
  if (!name) {
    fields.name = 'Nama kategori wajib diisi.'
  } else if (name.length < MIN_CATEGORY_NAME_LENGTH) {
    fields.name = `Nama kategori minimal terdiri dari ${MIN_CATEGORY_NAME_LENGTH} karakter.`
  } else if (name.length > MAX_CATEGORY_NAME_LENGTH) {
    fields.name = `Nama kategori maksimal ${MAX_CATEGORY_NAME_LENGTH} karakter.`
  }

  let description: string | null = null
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      fields.description = 'Deskripsi kategori harus berupa teks.'
    } else {
      const trimmedDescription = body.description.trim()
      if (trimmedDescription.length > MAX_CATEGORY_DESCRIPTION_LENGTH) {
        fields.description = `Deskripsi kategori maksimal ${MAX_CATEGORY_DESCRIPTION_LENGTH} karakter.`
      } else {
        description = trimmedDescription || null
      }
    }
  }

  if (Object.keys(fields).length > 0) {
    throw validationError(fields)
  }

  return { name, description }
}

function parseUpdatePayload(
  body: Record<string, unknown>,
  requireFullPayload: boolean
): UpdateCategoryInput {
  const fields: Record<string, string> = {}
  const updateInput: UpdateCategoryInput = {}

  const hasName = Object.prototype.hasOwnProperty.call(body, 'name')
  const hasDescription = Object.prototype.hasOwnProperty.call(body, 'description')

  if (!requireFullPayload && !hasName && !hasDescription) {
    throw validationError({
      name: 'Minimal satu field (nama atau deskripsi) harus dikirim untuk diperbarui.',
    })
  }

  if (requireFullPayload || hasName) {
    const name = asString(body.name).trim()
    if (!name) {
      fields.name = 'Nama kategori wajib diisi.'
    } else if (name.length < MIN_CATEGORY_NAME_LENGTH) {
      fields.name = `Nama kategori minimal terdiri dari ${MIN_CATEGORY_NAME_LENGTH} karakter.`
    } else if (name.length > MAX_CATEGORY_NAME_LENGTH) {
      fields.name = `Nama kategori maksimal ${MAX_CATEGORY_NAME_LENGTH} karakter.`
    } else {
      updateInput.name = name
    }
  }

  if (requireFullPayload || hasDescription) {
    if (body.description === undefined || body.description === null) {
      updateInput.description = null
    } else if (typeof body.description !== 'string') {
      fields.description = 'Deskripsi kategori harus berupa teks.'
    } else {
      const trimmedDescription = body.description.trim()
      if (trimmedDescription.length > MAX_CATEGORY_DESCRIPTION_LENGTH) {
        fields.description = `Deskripsi kategori maksimal ${MAX_CATEGORY_DESCRIPTION_LENGTH} karakter.`
      } else {
        updateInput.description = trimmedDescription || null
      }
    }
  }

  if (Object.keys(fields).length > 0) {
    throw validationError(fields)
  }

  return updateInput
}

/**
 * Memastikan pengguna yang memanggil endpoint mutasi sudah terautentikasi
 * melalui `requireAuth` dan memiliki `role === 'admin'` dari tabel `profiles`.
 */
export const requireAdmin: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const auth = req.auth

  if (!auth) {
    throw new AppError(
      401,
      'NO_SESSION',
      'Kamu belum masuk. Silakan login terlebih dahulu.'
    )
  }

  if (auth.profile.role !== 'admin') {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Hanya administrator LOKA yang dapat mengelola kategori jasa.'
    )
  }

  next()
}

export function createCategoryRouter(
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router()

  router.get(
    '/categories',
    asyncHandler(async (_req, res) => {
      const categories = await listCategories()
      sendSuccess(res, { categories })
    })
  )

  router.get(
    '/categories/:id',
    asyncHandler(async (req, res) => {
      const id = parseCategoryId(req.params.id)
      const category = await getCategoryById(id)
      sendSuccess(res, { category })
    })
  )

  router.post(
    '/categories',
    authMiddleware,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const auth = req.auth!
      const payload = parseCreatePayload(requestBody(req))
      const category = await createCategory(payload, auth.accessToken)

      sendSuccess(
        res,
        {
          category,
          message: 'Kategori jasa berhasil ditambahkan.',
        },
        201
      )
    })
  )

  const handleUpdateCategory = (requireFullPayload: boolean) =>
    asyncHandler(async (req, res) => {
      const auth = req.auth!
      const id = parseCategoryId(req.params.id)
      const payload = parseUpdatePayload(requestBody(req), requireFullPayload)
      const category = await updateCategory(id, payload, auth.accessToken)

      sendSuccess(res, {
        category,
        message: 'Kategori jasa berhasil diperbarui.',
      })
    })

  router.patch(
    '/categories/:id',
    authMiddleware,
    requireAdmin,
    handleUpdateCategory(false)
  )
  router.put(
    '/categories/:id',
    authMiddleware,
    requireAdmin,
    handleUpdateCategory(true)
  )

  router.delete(
    '/categories/:id',
    authMiddleware,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const auth = req.auth!
      const id = parseCategoryId(req.params.id)
      const category = await deleteCategory(id, auth.accessToken)

      sendSuccess(res, {
        category,
        deletedId: category.id,
        message: 'Kategori jasa berhasil dihapus.',
      })
    })
  )

  return router
}

export default createCategoryRouter()

