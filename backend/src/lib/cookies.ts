import type { Request, Response } from 'express'

export const ACCESS_COOKIE = 'loka_at'
export const REFRESH_COOKIE = 'loka_rt'
export const PERSIST_COOKIE = 'loka_persist'

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

function sameSiteValue(): 'lax' | 'strict' | 'none' {
  const configured = process.env.COOKIE_SAME_SITE?.trim().toLowerCase()

  if (configured === 'strict' || configured === 'none') return configured
  if (configured === 'lax') return configured

  // Separate production deployments are cross-origin, so browsers require
  // SameSite=None for the frontend to send these cookies to the API.
  return isProduction() ? 'none' : 'lax'
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {}

  return header.split(';').reduce<Record<string, string>>((cookies, part) => {
    const separatorIndex = part.indexOf('=')
    if (separatorIndex === -1) return cookies

    const name = part.slice(0, separatorIndex).trim()
    const rawValue = part.slice(separatorIndex + 1).trim()
    if (!name) return cookies

    try {
      cookies[name] = decodeURIComponent(rawValue)
    } catch {
      cookies[name] = rawValue
    }

    return cookies
  }, {})
}

export function readCookie(req: Request, name: string): string | undefined {
  return parseCookies(req.headers.cookie)[name]
}

interface CookieOptions {
  maxAgeSeconds?: number
  httpOnly?: boolean
}

function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `SameSite=${sameSiteValue()}`,
  ]

  if (options.httpOnly !== false) parts.push('HttpOnly')
  if (isProduction()) parts.push('Secure')
  if (options.maxAgeSeconds !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAgeSeconds)}`)

  return parts.join('; ')
}

export function setCookie(
  res: Response,
  name: string,
  value: string,
  options: CookieOptions = {}
): void {
  res.append('Set-Cookie', serializeCookie(name, value, options))
}

export function clearCookie(res: Response, name: string): void {
  res.append('Set-Cookie', serializeCookie(name, '', { maxAgeSeconds: 0 }))
}

export interface SessionTokens {
  accessToken: string
  refreshToken: string
}

/**
 * Stores Supabase tokens in httpOnly cookies. When "remember me" is off the
 * cookies are session cookies, so the browser drops them on close.
 */
export function writeSessionCookies(
  res: Response,
  tokens: SessionTokens,
  remember: boolean
): void {
  const maxAgeSeconds = remember ? THIRTY_DAYS_SECONDS : undefined

  setCookie(res, ACCESS_COOKIE, tokens.accessToken, { maxAgeSeconds })
  setCookie(res, REFRESH_COOKIE, tokens.refreshToken, { maxAgeSeconds })

  if (remember) {
    setCookie(res, PERSIST_COOKIE, '1', { maxAgeSeconds })
  } else {
    clearCookie(res, PERSIST_COOKIE)
  }
}

export function clearAuthCookies(res: Response): void {
  clearCookie(res, ACCESS_COOKIE)
  clearCookie(res, REFRESH_COOKIE)
  clearCookie(res, PERSIST_COOKIE)
}

export function hasRememberPreference(req: Request): boolean {
  return readCookie(req, PERSIST_COOKIE) === '1'
}
