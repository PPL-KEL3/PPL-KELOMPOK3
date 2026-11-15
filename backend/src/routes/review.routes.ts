import { Router, type Request, type RequestHandler } from 'express'
import { AppError } from '../lib/errors'
import { asyncHandler, sendSuccess } from '../lib/http'
import { asString } from '../lib/validation'
import { requireAuth } from '../middleware/auth.middleware'
import {
  createReview,
  deleteReview,
  getCustomerReviews,
  getProviderReviews,
  getReviewByBooking,
  updateReview,
} from '../services/review.service'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseReviewId(raw: unknown): string {
  const id = asString(raw).trim()
  if (!UUID_PATTERN.test(id)) {
    throw new AppError(400, 'INVALID_REVIEW_ID', 'Format ID ulasan tidak valid.')
  }
  return id
}

export function createReviewRouter(
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router()

  /**
   * GET /api/reviews/provider/:providerId
   * Public: List all reviews & aggregated ratings for a provider
   */
  router.get(
    '/reviews/provider/:providerId',
    asyncHandler(async (req, res) => {
      const providerId = parseReviewId(req.params.providerId)
      const result = await getProviderReviews(providerId)
      sendSuccess(res, result)
    })
  )

  /**
   * GET /api/reviews/mine
   * Protected: List all reviews written by current customer
   */
  router.get(
    '/reviews/mine',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const auth = req.auth
      if (!auth) {
        throw new AppError(401, 'NO_SESSION', 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.')
      }

      const result = await getCustomerReviews(auth.profile.id, auth.accessToken)
      sendSuccess(res, result)
    })
  )

  /**
   * GET /api/reviews/booking/:bookingId
   * Protected: Check review for a specific booking
   */
  router.get(
    '/reviews/booking/:bookingId',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const auth = req.auth
      if (!auth) {
        throw new AppError(401, 'NO_SESSION', 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.')
      }

      const bookingId = parseReviewId(req.params.bookingId)
      const result = await getReviewByBooking(bookingId, auth.accessToken)
      sendSuccess(res, result)
    })
  )

  /**
   * POST /api/reviews
   * Protected: Customer submits a rating & review for an accepted booking
   */
  router.post(
    '/reviews',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const auth = req.auth
      if (!auth) {
        throw new AppError(401, 'NO_SESSION', 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.')
      }

      const review = await createReview(
        auth.profile.id,
        req.body,
        auth.accessToken
      )

      sendSuccess(
        res,
        {
          review,
          message: 'Ulasan dan rating Anda berhasil disimpan. Terima kasih atas masukan Anda!',
        },
        201
      )
    })
  )

  /**
   * PATCH /api/reviews/:id
   * Protected: Customer edits their rating & comment within max edit limit
   */
  router.patch(
    '/reviews/:id',
    authMiddleware,
    asyncHandler(async (req: Request, res) => {
      const auth = req.auth
      if (!auth) {
        throw new AppError(401, 'NO_SESSION', 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.')
      }

      const id = parseReviewId(req.params.id)
      const review = await updateReview(
        id,
        auth.profile.id,
        req.body,
        auth.accessToken
      )

      sendSuccess(res, {
        review,
        message: 'Ulasan Anda berhasil diperbarui.',
      })
    })
  )

  /**
   * DELETE /api/reviews/:id
   * Protected: Customer withdraws/deletes their review
   */
  router.delete(
    '/reviews/:id',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const auth = req.auth
      if (!auth) {
        throw new AppError(401, 'NO_SESSION', 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.')
      }

      const id = parseReviewId(req.params.id)
      const result = await deleteReview(id, auth.profile.id, auth.accessToken)

      sendSuccess(res, {
        deletedId: result.deletedId,
        message: 'Ulasan berhasil ditarik.',
      })
    })
  )

  return router
}

export default createReviewRouter()
