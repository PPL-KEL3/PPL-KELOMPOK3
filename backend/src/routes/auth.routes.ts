import { Router, type Request, type Response } from 'express'
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  readCookie,
  writeSessionCookies,
} from '../lib/cookies'
import { AppError } from '../lib/errors'
import { asyncHandler, sendSuccess } from '../lib/http'
import {
  asBoolean,
  asString,
  isValidFullName,
  normalizeEmail,
  validateEmailField,
  validatePasswordField,
} from '../lib/validation'
import { requireAuth } from '../middleware/auth.middleware'
import {
  loginWithPassword,
  registerUser,
  resetPassword,
  revokeSession,
  sendPasswordReset,
} from '../services/auth.service'
import { redirectPathFor, type UserRole } from '../services/profile.service'

const router = Router()

function getResetPasswordRedirectUrl(): string {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
    /\/$/,
    ''
  )
  return `${frontendUrl}/reset-password`
}

function validationError(fields: Record<string, string>): AppError {
  return new AppError(
    400,
    'VALIDATION_ERROR',
    'Periksa kembali data yang kamu masukkan.',
    fields
  )
}

function requestBody(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>
}

router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const body = requestBody(req)
    const email = normalizeEmail(body.email)
    const password = asString(body.password)
    const remember = asBoolean(body.remember)

    const fields: Record<string, string> = {}
    const emailError = validateEmailField(email)
    if (emailError) fields.email = emailError
    if (!password) fields.password = 'Password wajib diisi.'

    if (Object.keys(fields).length > 0) {
      throw validationError(fields)
    }

    const result = await loginWithPassword(email, password)

    writeSessionCookies(
      res,
      {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      remember
    )

    sendSuccess(res, {
      user: result.profile,
      redirectTo: result.redirectTo,
    })
  })
)

router.post(
  '/auth/register',
  asyncHandler(async (req, res) => {
    const body = requestBody(req)
    const fullName = asString(body.fullName).trim()
    const email = normalizeEmail(body.email)
    const password = asString(body.password)
    const role = asString(body.role).trim().toLowerCase()

    const fields: Record<string, string> = {}

    if (!fullName) {
      fields.fullName = 'Nama lengkap wajib diisi.'
    } else if (!isValidFullName(fullName)) {
      fields.fullName = 'Nama lengkap harus terdiri dari 2–80 karakter.'
    }

    const emailError = validateEmailField(email)
    if (emailError) fields.email = emailError

    const passwordError = validatePasswordField(password)
    if (passwordError) fields.password = passwordError

    if (role !== 'customer' && role !== 'provider') {
      console.warn('[auth] Rejected public registration role', { role })
      fields.role = 'Pilih jenis akun Customer atau Penyedia Jasa.'
    }

    if (Object.keys(fields).length > 0) {
      throw validationError(fields)
    }

    const result = await registerUser({
      fullName,
      email,
      password,
      role: role as Extract<UserRole, 'customer' | 'provider'>,
    })

    if (result.tokens && result.profile) {
      writeSessionCookies(res, result.tokens, false)
    }

    sendSuccess(
      res,
      {
        user: result.profile,
        redirectTo: result.redirectTo,
        requiresEmailConfirmation: result.requiresEmailConfirmation,
        message: result.message,
      },
      201
    )
  })
)

router.get('/auth/me', requireAuth, (req: Request, res: Response) => {
  const auth = req.auth

  if (!auth) {
    throw new AppError(401, 'NO_SESSION', 'Kamu belum masuk. Silakan login terlebih dahulu.')
  }

  sendSuccess(res, {
    user: auth.profile,
    redirectTo: redirectPathFor(auth.profile),
  })
})

router.post(
  '/auth/logout',
  asyncHandler(async (req, res) => {
    const accessToken = readCookie(req, ACCESS_COOKIE)
    const refreshToken = readCookie(req, REFRESH_COOKIE)

    await revokeSession(accessToken, refreshToken)
    clearAuthCookies(res)

    sendSuccess(res, { loggedOut: true })
  })
)

router.post(
  '/auth/forgot-password',
  asyncHandler(async (req, res) => {
    const body = requestBody(req)
    const email = normalizeEmail(body.email)
    const emailError = validateEmailField(email)

    if (emailError) {
      throw validationError({ email: emailError })
    }

    await sendPasswordReset(email, getResetPasswordRedirectUrl())

    // Never reveal whether the email is registered.
    sendSuccess(res, {
      message:
        'Jika alamat email tersebut terdaftar, kami telah mengirim link untuk mengatur ulang password.',
    })
  })
)

router.post(
  '/auth/reset-password',
  asyncHandler(async (req, res) => {
    const body = requestBody(req)
    const password = asString(body.password)
    const tokenHash = asString(body.tokenHash).trim() || undefined
    const accessToken = asString(body.accessToken).trim() || undefined
    const refreshToken = asString(body.refreshToken).trim() || undefined
    const code = asString(body.code).trim() || undefined

    const passwordError = validatePasswordField(password)
    if (passwordError) {
      throw validationError({ password: passwordError })
    }

    if (!tokenHash && !accessToken && !code) {
      throw new AppError(
        400,
        'INVALID_RESET_LINK',
        'Link reset password tidak valid atau sudah kedaluwarsa.'
      )
    }

    await resetPassword({
      password,
      tokenHash,
      accessToken,
      refreshToken,
      code,
    })

    sendSuccess(res, {
      message: 'Password berhasil diubah. Silakan masuk dengan password baru kamu.',
    })
  })
)

export default router
