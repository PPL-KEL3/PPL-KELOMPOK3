import type { RequestHandler } from 'express'
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  hasRememberPreference,
  readCookie,
  writeSessionCookies,
} from '../lib/cookies'
import { asyncHandler } from '../lib/http'
import { resolveSession } from '../services/auth.service'

/**
 * Validates the session with Supabase and attaches the trusted profile/role.
 * Every protected endpoint must use this middleware; the frontend middleware is
 * only a UX layer and never the source of authorization.
 */
export const requireAuth: RequestHandler = asyncHandler(async (req, res, next) => {
  const accessToken = readCookie(req, ACCESS_COOKIE)
  const refreshToken = readCookie(req, REFRESH_COOKIE)

  try {
    const session = await resolveSession(accessToken, refreshToken)

    if (session.refreshed) {
      writeSessionCookies(
        res,
        {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
        },
        hasRememberPreference(req)
      )
    }

    req.auth = {
      profile: session.profile,
      accessToken: session.accessToken,
      remember: hasRememberPreference(req),
    }

    next()
  } catch (error) {
    clearAuthCookies(res)
    throw error
  }
})
