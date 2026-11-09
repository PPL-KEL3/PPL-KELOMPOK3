import type { AuthUser } from './auth-types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

interface ApiSuccess<T> {
  success: true
  data: T
}

interface ApiFailure {
  success: false
  error: {
    code?: string
    message?: string
    fields?: Record<string, string>
  }
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const hasBody = options.body !== undefined

  let response: Response

  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      ...options,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers ?? {}),
      },
    })
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Tidak dapat terhubung ke server. Coba lagi.'
    )
  }

  const text = await response.text()
  let payload: ApiSuccess<T> | ApiFailure | null = null

  if (text) {
    try {
      payload = JSON.parse(text) as ApiSuccess<T> | ApiFailure
    } catch {
      payload = null
    }
  }

  if (!response.ok || !payload || payload.success === false) {
    const failure = payload && payload.success === false ? payload : null
    throw new ApiError(
      response.status,
      failure?.error.code ?? 'REQUEST_FAILED',
      failure?.error.message ?? 'Terjadi kesalahan. Silakan coba lagi.',
      failure?.error.fields
    )
  }

  return payload.data
}

export interface LoginInput {
  email: string
  password: string
  remember: boolean
}

export interface LoginResult {
  user: AuthUser
  redirectTo: string
}

export interface RegisterInput {
  fullName: string
  email: string
  password: string
  role: 'customer' | 'provider'
}

export interface RegisterResult {
  user: AuthUser | null
  redirectTo: string | null
  requiresEmailConfirmation: boolean
  message: string
}

export interface MeResult {
  user: AuthUser
  redirectTo: string
}

export interface MessageResult {
  message: string
}

export interface ResetPasswordInput {
  password: string
  tokenHash?: string
  accessToken?: string
  refreshToken?: string
  code?: string
}

export interface VerificationResult {
  user: AuthUser
  redirectTo: string
  message: string
}

export const authApi = {
  login(input: LoginInput) {
    return request<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  register(input: RegisterInput) {
    return request<RegisterResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  me() {
    return request<MeResult>('/auth/me')
  },

  logout() {
    return request<{ loggedOut: boolean }>('/auth/logout', {
      method: 'POST',
    })
  },

  forgotPassword(email: string) {
    return request<MessageResult>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  resetPassword(input: ResetPasswordInput) {
    return request<MessageResult>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  requestProviderVerification() {
    return request<VerificationResult>('/provider/request-verification', {
      method: 'POST',
    })
  },
}
