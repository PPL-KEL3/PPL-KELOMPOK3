'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  ApiError,
  authApi,
  type LoginInput,
  type LoginResult,
  type RegisterInput,
  type RegisterResult,
} from '@/lib/api'
import type { AuthUser } from '@/lib/auth-types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  sessionExpired: boolean
  authError: string | null
  bootError: string | null
  login: (input: LoginInput) => Promise<LoginResult>
  register: (input: RegisterInput) => Promise<RegisterResult>
  logout: () => Promise<void>
  refresh: () => Promise<AuthUser | null>
  retry: () => Promise<AuthUser | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)

  const loadSession = useCallback(async (showLoading: boolean): Promise<AuthUser | null> => {
    if (showLoading) setLoading(true)
    setBootError(null)

    try {
      const result = await authApi.me()
      setUser(result.user)
      setSessionExpired(false)
      setAuthError(null)
      return result.user
    } catch (error) {
      setUser(null)

      if (error instanceof ApiError) {
        if (error.code === 'SESSION_EXPIRED') {
          setSessionExpired(true)
          setAuthError(null)
        } else if (error.code === 'INVALID_ROLE' || error.code === 'PROFILE_MISSING') {
          setAuthError(error.message)
        } else if (error.code !== 'NO_SESSION') {
          setBootError(error.message)
        }
      } else {
        setBootError('Tidak dapat terhubung ke server. Coba lagi.')
      }

      return null
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSession(true)
  }, [loadSession])

  const login = useCallback(async (input: LoginInput): Promise<LoginResult> => {
    const result = await authApi.login(input)
    setUser(result.user)
    setSessionExpired(false)
    setAuthError(null)
    setBootError(null)
    return result
  }, [])

  const register = useCallback(
    async (input: RegisterInput): Promise<RegisterResult> => {
      const result = await authApi.register(input)

      if (result.user) {
        setUser(result.user)
        setSessionExpired(false)
        setAuthError(null)
        setBootError(null)
      }

      return result
    },
    []
  )

  const logout = useCallback(async (): Promise<void> => {
    await authApi.logout()
    setUser(null)
    setSessionExpired(false)
    setAuthError(null)
    setBootError(null)
  }, [])

  const refresh = useCallback(() => loadSession(false), [loadSession])
  const retry = useCallback(() => loadSession(true), [loadSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      sessionExpired,
      authError,
      bootError,
      login,
      register,
      logout,
      refresh,
      retry,
    }),
    [user, loading, sessionExpired, authError, bootError, login, register, logout, refresh, retry]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
