import type { Session, User } from '@supabase/supabase-js'
import {
  createSupabaseClient,
  getSupabaseEnv,
  supabaseConfigured,
} from '../config/supabase'
import { AppError } from '../lib/errors'
import {
  getProfileForUser,
  redirectPathFor,
  type AuthProfile,
  type UserRole,
} from './profile.service'

interface SupabaseAuthError {
  code?: string
  status?: number
  message?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginResult extends AuthTokens {
  profile: AuthProfile
  redirectTo: string
}

export interface RegisterResult {
  profile: AuthProfile | null
  redirectTo: string | null
  tokens: AuthTokens | null
  requiresEmailConfirmation: boolean
  message: string
}

export interface ResolvedSession extends AuthTokens {
  profile: AuthProfile
  refreshed: boolean
}

export interface ResetPasswordInput {
  password: string
  tokenHash?: string
  accessToken?: string
  refreshToken?: string
  code?: string
}

function ensureConfigured(): void {
  if (!supabaseConfigured) {
    throw new AppError(
      503,
      'AUTH_UNAVAILABLE',
      'Layanan autentikasi belum dikonfigurasi. Hubungi administrator LOKA.'
    )
  }
}

function logSupabaseError(action: string, error: SupabaseAuthError): void {
  // Never log tokens, passwords, or the full Supabase response body.
  console.error('[auth] Supabase auth error', {
    action,
    code: error.code ?? 'unknown',
    status: error.status ?? null,
  })
}

function commonAuthError(error: SupabaseAuthError): AppError | null {
  const code = error.code ?? ''
  const message = error.message ?? ''

  if (
    code === 'invalid_credentials' ||
    /invalid login credentials/i.test(message)
  ) {
    return new AppError(401, 'INVALID_CREDENTIALS', 'Email atau password tidak sesuai.')
  }

  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return new AppError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Silakan verifikasi email kamu terlebih dahulu.'
    )
  }

  if (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    error.status === 429
  ) {
    return new AppError(
      429,
      'RATE_LIMITED',
      'Terlalu banyak percobaan. Silakan coba lagi beberapa saat.'
    )
  }

  if (code === 'weak_password') {
    return new AppError(400, 'WEAK_PASSWORD', 'Password terlalu lemah. Gunakan minimal 8 karakter.')
  }

  if (code === 'user_already_exists' || code === 'email_exists') {
    return new AppError(
      409,
      'EMAIL_ALREADY_REGISTERED',
      'Email sudah terdaftar. Silakan masuk atau gunakan fitur lupa password.'
    )
  }

  if (code === 'signup_disabled') {
    return new AppError(
      403,
      'SIGNUP_DISABLED',
      'Pendaftaran akun sedang tidak tersedia. Coba lagi nanti.'
    )
  }

  return null
}

function authServiceError(action: string, error: SupabaseAuthError): AppError {
  const known = commonAuthError(error)
  if (known) return known

  logSupabaseError(action, error)
  return new AppError(
    502,
    'AUTH_SERVICE_ERROR',
    'Layanan autentikasi sedang bermasalah. Silakan coba lagi.'
  )
}

function tokensFromSession(session: Session): AuthTokens {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  }
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<LoginResult> {
  ensureConfigured()

  const client = createSupabaseClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })

  if (error) {
    throw authServiceError('login', error)
  }

  if (!data.session || !data.user) {
    throw new AppError(
      502,
      'AUTH_SERVICE_ERROR',
      'Layanan autentikasi sedang bermasalah. Silakan coba lagi.'
    )
  }

  const profile = await getProfileForUser(
    data.user.id,
    data.session.access_token,
    data.user.email ?? email
  )

  return {
    profile,
    redirectTo: redirectPathFor(profile),
    ...tokensFromSession(data.session),
  }
}

export async function registerUser(input: {
  fullName: string
  email: string
  password: string
  role: Extract<UserRole, 'customer' | 'provider'>
}): Promise<RegisterResult> {
  ensureConfigured()

  const client = createSupabaseClient()
  const { data, error } = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName,
        // The database trigger only accepts customer | provider from metadata.
        role: input.role,
      },
    },
  })

  if (error) {
    throw authServiceError('register', error)
  }

  if (!data.user) {
    throw new AppError(
      502,
      'AUTH_SERVICE_ERROR',
      'Pendaftaran belum dapat diproses. Silakan coba lagi.'
    )
  }

  if (!data.session) {
    return {
      profile: null,
      redirectTo: null,
      tokens: null,
      requiresEmailConfirmation: true,
      message:
        'Pendaftaran berhasil. Silakan periksa email kamu untuk memverifikasi akun sebelum masuk.',
    }
  }

  const profile = await getProfileForUser(
    data.user.id,
    data.session.access_token,
    data.user.email ?? input.email
  )

  return {
    profile,
    redirectTo: redirectPathFor(profile),
    tokens: tokensFromSession(data.session),
    requiresEmailConfirmation: false,
    message: 'Pendaftaran berhasil.',
  }
}

/**
 * Resolves the session from httpOnly cookies. Expired access tokens are
 * refreshed automatically so a signed-in user is not asked to log in again.
 */
export async function resolveSession(
  accessToken: string | undefined,
  refreshToken: string | undefined
): Promise<ResolvedSession> {
  ensureConfigured()

  let user: User | null = null
  let resolvedAccessToken = accessToken
  let resolvedRefreshToken = refreshToken
  let refreshed = false

  if (accessToken) {
    const client = createSupabaseClient()
    const { data, error } = await client.auth.getUser(accessToken)

    if (!error && data.user) {
      user = data.user
    }
  }

  if (!user && refreshToken) {
    const client = createSupabaseClient()
    const { data, error } = await client.auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (!error && data.session?.user) {
      user = data.session.user
      resolvedAccessToken = data.session.access_token
      resolvedRefreshToken = data.session.refresh_token
      refreshed = true
    }
  }

  if (!user || !resolvedAccessToken) {
    if (!accessToken && !refreshToken) {
      throw new AppError(401, 'NO_SESSION', 'Kamu belum masuk. Silakan login terlebih dahulu.')
    }

    throw new AppError(
      401,
      'SESSION_EXPIRED',
      'Sesi kamu telah berakhir. Silakan login kembali.'
    )
  }

  const profile = await getProfileForUser(
    user.id,
    resolvedAccessToken,
    user.email ?? ''
  )

  return {
    profile,
    accessToken: resolvedAccessToken,
    refreshToken: resolvedRefreshToken ?? '',
    refreshed,
  }
}

export async function revokeSession(
  accessToken: string | undefined,
  refreshToken: string | undefined
): Promise<void> {
  if (!supabaseConfigured || (!accessToken && !refreshToken)) return

  let token = accessToken

  // If the access token is already expired, refresh first so Supabase can
  // actually revoke the session instead of leaving a valid refresh token behind.
  if (refreshToken) {
    try {
      const client = createSupabaseClient()
      const { data } = await client.auth.refreshSession({ refresh_token: refreshToken })
      if (data.session?.access_token) {
        token = data.session.access_token
      }
    } catch (error) {
      console.warn('[auth] Could not refresh session for logout', {
        name: error instanceof Error ? error.name : 'unknown',
      })
    }
  }

  if (!token) return

  try {
    const { url, anonKey } = getSupabaseEnv()
    const response = await fetch(`${url}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok && response.status !== 401) {
      console.warn('[auth] Could not revoke Supabase session', {
        status: response.status,
      })
    }
  } catch (error) {
    console.warn('[auth] Could not reach Supabase to revoke session', {
      name: error instanceof Error ? error.name : 'unknown',
    })
  }
}

export async function sendPasswordReset(
  email: string,
  redirectTo: string
): Promise<void> {
  ensureConfigured()

  const client = createSupabaseClient()
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo })

  if (error) {
    const known = commonAuthError(error)
    if (known?.code === 'RATE_LIMITED') {
      throw known
    }

    logSupabaseError('forgot-password', error)
    throw new AppError(
      502,
      'AUTH_SERVICE_ERROR',
      'Permintaan reset password belum dapat diproses. Silakan coba lagi.'
    )
  }
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  ensureConfigured()

  const client = createSupabaseClient()
  let authenticated = false

  if (input.tokenHash) {
    const { data, error } = await client.auth.verifyOtp({
      type: 'recovery',
      token_hash: input.tokenHash,
    })

    if (error || !data.session) {
      logSupabaseError('reset-password-verify', error ?? {})
      throw new AppError(
        400,
        'INVALID_RESET_LINK',
        'Link reset password tidak valid atau sudah kedaluwarsa.'
      )
    }

    authenticated = true
  } else if (input.accessToken && input.refreshToken) {
    const { data, error } = await client.auth.setSession({
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
    })

    if (error || !data.session) {
      logSupabaseError('reset-password-session', error ?? {})
      throw new AppError(
        400,
        'INVALID_RESET_LINK',
        'Link reset password tidak valid atau sudah kedaluwarsa.'
      )
    }

    authenticated = true
  } else if (input.code) {
    const { data, error } = await client.auth.exchangeCodeForSession(input.code)

    if (error || !data.session) {
      logSupabaseError('reset-password-code', error ?? {})
      throw new AppError(
        400,
        'INVALID_RESET_LINK',
        'Link reset password tidak valid atau sudah kedaluwarsa.'
      )
    }

    authenticated = true
  }

  if (!authenticated) {
    throw new AppError(
      400,
      'INVALID_RESET_LINK',
      'Link reset password tidak valid atau sudah kedaluwarsa.'
    )
  }

  const { error } = await client.auth.updateUser({ password: input.password })

  if (error) {
    throw authServiceError('reset-password-update', error)
  }

  // End every existing session after a password change.
  const { error: signOutError } = await client.auth.signOut({ scope: 'global' })
  if (signOutError) {
    logSupabaseError('reset-password-signout', signOutError)
  }
}

export async function requestProviderVerification(
  accessToken: string,
  userId: string,
  fallbackEmail: string
): Promise<AuthProfile> {
  ensureConfigured()

  const client = createSupabaseClient(accessToken)
  const { error } = await client.rpc('request_provider_verification')

  if (error) {
    console.error('[provider] Verification request failed', {
      code: error.code ?? 'unknown',
    })
    throw new AppError(
      503,
      'VERIFICATION_UNAVAILABLE',
      'Permintaan verifikasi belum dapat diproses. Silakan coba lagi nanti.'
    )
  }

  return getProfileForUser(userId, accessToken, fallbackEmail)
}
