'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { AuthLoadingScreen } from './AuthLoadingScreen'
import { useToast } from '@/components/ui/ToastProvider'
import { dashboardPathFor, type UserRole } from '@/lib/auth-types'

interface RoleGateProps {
  role: UserRole
  requireVerifiedProvider?: boolean
  children: ReactNode
}

export function RoleGate({ role, requireVerifiedProvider = false, children }: RoleGateProps) {
  const { user, loading, sessionExpired, authError, bootError, retry } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const toast = useToast()

  useEffect(() => {
    if (loading) return

    if (!user) {
      if (authError) {
        router.replace('/login?reason=invalid-role')
        return
      }

      if (bootError) return

      const params = new URLSearchParams()
      params.set('next', pathname)
      if (sessionExpired) params.set('expired', '1')
      router.replace(`/login?${params.toString()}`)
      return
    }

    if (user.role !== role) {
      toast.error('Kamu tidak memiliki akses ke halaman tersebut.')
      router.replace(dashboardPathFor(user))
      return
    }

    if (requireVerifiedProvider && user.providerVerificationStatus !== 'verified') {
      router.replace('/provider/verification')
    }
  }, [
    loading,
    user,
    role,
    requireVerifiedProvider,
    router,
    pathname,
    sessionExpired,
    authError,
    bootError,
    toast,
  ])

  if (bootError && !user && !loading) {
    return (
      <div className="auth-boot" role="alert">
        <span className="auth-boot__icon">!</span>
        <h1>Koneksi bermasalah</h1>
        <p>{bootError}</p>
        <button type="button" className="auth-submit auth-boot__button" onClick={() => void retry()}>
          Coba lagi
        </button>
      </div>
    )
  }

  if (loading || !user) {
    return <AuthLoadingScreen />
  }

  if (user.role !== role) {
    return <AuthLoadingScreen message="Mengalihkan ke dashboard kamu…" />
  }

  if (requireVerifiedProvider && user.providerVerificationStatus !== 'verified') {
    return <AuthLoadingScreen message="Mengalihkan ke status verifikasi…" />
  }

  return <>{children}</>
}
