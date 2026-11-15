'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { useToast } from '@/components/ui/ToastProvider'
import { LokaLogo } from '@/components/ui/LokaLogo'
import { LogOutIcon } from '@/components/ui/AuthIcons'
import { useInsideProviderSidebar } from '@/components/provider/ProviderSidebarContext'
import {
  ROLE_LABELS,
  VERIFICATION_LABELS,
  type ProviderVerificationStatus,
} from '@/lib/auth-types'

interface DashboardShellProps {
  eyebrow: string
  title: string
  description: string
  children?: ReactNode
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function DashboardShell({
  eyebrow,
  title,
  description,
  children,
}: DashboardShellProps) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const [loggingOut, setLoggingOut] = useState(false)
  const insideSidebar = useInsideProviderSidebar()

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)

    try {
      await logout()
      router.replace('/login')
      router.refresh()
    } catch {
      toast.error('Tidak dapat mengakhiri sesi. Silakan coba lagi.')
      setLoggingOut(false)
    }
  }

  if (!user) return null

  const statusLabel =
    user.role === 'provider' && user.providerVerificationStatus
      ? VERIFICATION_LABELS[user.providerVerificationStatus as ProviderVerificationStatus]
      : ROLE_LABELS[user.role]

  if (insideSidebar) {
    return (
      <main className="dash-main dash-main--in-sidebar">
        <div className="dash-main__inner">
          <div className="dash-hero">
            <p className="dash-hero__eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>

          {children}
        </div>
      </main>
    )
  }

  return (
    <div className="dash-page">
      <header className="dash-header">
        <div className="dash-header__inner">
          <LokaLogo />
          <div className="dash-header__actions">
            <Link href="/" className="dash-home-link">
              Beranda
            </Link>
            <div className="dash-user">
              <span className="dash-avatar" aria-hidden="true">
                {initials(user.fullName)}
              </span>
              <span className="dash-user__copy">
                <strong>{user.fullName}</strong>
                <small>{statusLabel}</small>
              </span>
            </div>
            <button
              type="button"
              className="dash-logout"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <span className="auth-spinner" aria-hidden="true" />
              ) : (
                <LogOutIcon size={17} />
              )}
              <span>{loggingOut ? 'Keluar…' : 'Keluar'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-main__inner">
          <div className="dash-hero">
            <p className="dash-hero__eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
            <div className="dash-badges">
              <span className="dash-badge">{ROLE_LABELS[user.role]}</span>
              {user.role === 'provider' && user.providerVerificationStatus && (
                <span
                  className={`dash-badge dash-badge--${user.providerVerificationStatus}`}
                >
                  {VERIFICATION_LABELS[user.providerVerificationStatus]}
                </span>
              )}
              <span className="dash-badge dash-badge--muted">{user.email}</span>
            </div>
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}
