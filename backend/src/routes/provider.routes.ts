import { Router } from 'express'
import { AppError } from '../lib/errors'
import { asyncHandler, sendSuccess } from '../lib/http'
import { requireAuth } from '../middleware/auth.middleware'
import { requestProviderVerification } from '../services/auth.service'
import { redirectPathFor } from '../services/profile.service'

const router = Router()

router.post(
  '/provider/request-verification',
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = req.auth

    if (!auth) {
      throw new AppError(401, 'NO_SESSION', 'Kamu belum masuk. Silakan login terlebih dahulu.')
    }

    if (auth.profile.role !== 'provider') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Hanya akun penyedia jasa yang dapat mengajukan verifikasi.'
      )
    }

    const profile = await requestProviderVerification(
      auth.accessToken,
      auth.profile.id,
      auth.profile.email
    )

    sendSuccess(res, {
      user: profile,
      redirectTo: redirectPathFor(profile),
      message: 'Pengajuan verifikasi berhasil dikirim ulang.',
    })
  })
)

export default router
