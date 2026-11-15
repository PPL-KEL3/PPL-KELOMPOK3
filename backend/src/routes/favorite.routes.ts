import { Router, type Request, type RequestHandler } from 'express'
import { AppError } from '../lib/errors'
import { asyncHandler, sendSuccess } from '../lib/http'
import { asString } from '../lib/validation'
import { requireAuth } from '../middleware/auth.middleware'
import {
  addFavorite,
  getFavoriteById,
  listFavorites,
  removeFavorite,
  updateFavorite,
  type FavoriteItemType,
} from '../services/favorite.service'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseFavoriteId(raw: unknown): string {
  const id = asString(raw).trim()
  if (!UUID_PATTERN.test(id)) {
    throw new AppError(400, 'INVALID_FAVORITE_ID', 'Format ID favorit tidak valid.')
  }
  return id
}

export function createFavoriteRouter(
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router()

  /**
   * GET /api/favorites
   * List customer's favorites, optionally filtered by ?itemType=service|provider
   */
  router.get(
    '/favorites',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const auth = req.auth
      if (!auth) {
        throw new AppError(401, 'NO_SESSION', 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.')
      }

      const itemTypeParam = req.query.itemType as string | undefined
      let itemTypeFilter: FavoriteItemType | undefined = undefined
      if (itemTypeParam === 'service' || itemTypeParam === 'provider') {
        itemTypeFilter = itemTypeParam
      }

      const favorites = await listFavorites(
        auth.profile.id,
        auth.accessToken,
        itemTypeFilter
      )

      sendSuccess(res, {
        favorites,
        count: favorites.length,
      })
    })
  )

  /**
   * GET /api/favorites/:id
   * Get single favorite item by ID
   */
  router.get(
    '/favorites/:id',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const auth = req.auth
      if (!auth) {
        throw new AppError(401, 'NO_SESSION', 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.')
      }

      const id = parseFavoriteId(req.params.id)
      const favorite = await getFavoriteById(id, auth.profile.id, auth.accessToken)

      sendSuccess(res, { favorite })
    })
  )

  /**
   * POST /api/favorites
   * Add service or provider to customer's favorites
   */
  router.post(
    '/favorites',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const auth = req.auth
      if (!auth) {
        throw new AppError(401, 'NO_SESSION', 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.')
      }

      const favorite = await addFavorite(
        auth.profile.id,
        req.body,
        auth.accessToken
      )

      sendSuccess(
        res,
        {
          favorite,
          message:
            favorite.itemType === 'service'
              ? 'Layanan berhasil ditambahkan ke daftar favorit.'
              : 'Penyedia jasa berhasil ditambahkan ke daftar favorit.',
        },
        201
      )
    })
  )

  /**
   * PATCH & PUT /api/favorites/:id
   * Update notes or label on favorite item
   */
  const handleUpdate = asyncHandler(async (req: Request, res) => {
    const auth = req.auth
    if (!auth) {
      throw new AppError(401, 'NO_SESSION', 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.')
    }

    const id = parseFavoriteId(req.params.id)
    const favorite = await updateFavorite(
      id,
      auth.profile.id,
      req.body,
      auth.accessToken
    )

    sendSuccess(res, {
      favorite,
      message: 'Catatan favorit berhasil diperbarui.',
    })
  })

  router.patch('/favorites/:id', authMiddleware, handleUpdate)
  router.put('/favorites/:id', authMiddleware, handleUpdate)

  /**
   * DELETE /api/favorites/:id
   * Remove item from customer's favorites
   */
  router.delete(
    '/favorites/:id',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const auth = req.auth
      if (!auth) {
        throw new AppError(401, 'NO_SESSION', 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.')
      }

      const id = parseFavoriteId(req.params.id)
      const result = await removeFavorite(id, auth.profile.id, auth.accessToken)

      sendSuccess(res, {
        deletedId: result.deletedId,
        message: 'Item berhasil dihapus dari daftar favorit.',
      })
    })
  )

  return router
}

export default createFavoriteRouter()
