'use client'

import { useState, type ComponentType, type SVGProps } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { useToast } from '@/components/ui/ToastProvider'
import { LokaLogo } from '@/components/ui/LokaLogo'
import {
  BriefcaseIcon,
  IdCardIcon,
  LayoutDashboardIcon,
  LogOutIcon,
} from '@/components/ui/AuthIcons'
import { VERIFICATION_LABELS } from '@/lib/auth-types'

type NavIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

interface NavItem {
  label: string
  href: string
  icon: NavIcon
  match: 'exact' | 'prefix'
  badge?: string
}

// Menu baru (Paket & Harga, Portofolio, dst.) cukup ditambah satu baris di sini.
export const PROVIDER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/provider/dashboard', icon: LayoutDashboardIcon, match: 'exact' },
  { label: 'Daftar Jasa', href: '/provider/dashboard/services', icon: BriefcaseIcon, match: 'prefix' },
  { label: 'Profil Penyedia', href: '/provider/profile', icon: IdCardIcon, match: 'prefix' },
]

function isActive(pathname: string, item: NavItem): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (item.match === 'exact') return path === item.href
  return path === item.href || path.startsWith(`${item.href}/`)
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

interface ProviderSidebarProps {
  onNavigate?: () => void
}

export function ProviderSidebar({ onNavigate }: ProviderSidebarProps) {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()
  const [loggingOut, setLoggingOut] = useState(false)

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

  const statusLabel = user.providerVerificationStatus
    ? VERIFICATION_LABELS[user.providerVerificationStatus]
    : 'Penyedia Jasa'

  return (
    <aside className="prov-sidebar" aria-label="Navigasi penyedia jasa">
      <div className="prov-sidebar__top">
        <div className="prov-sidebar__logo">
          <LokaLogo />
        </div>

        <nav className="prov-nav" aria-label="Menu penyedia jasa">
          <p className="prov-nav__section">Penyedia Jasa</p>
          {PROVIDER_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`prov-nav__item${active ? ' prov-nav__item--active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
              >
                <Icon size={18} />
                <span className="prov-nav__label">{item.label}</span>
                {item.badge && <span className="prov-nav__badge">{item.badge}</span>}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="prov-account">
        <div className="prov-account__user">
          <span className="dash-avatar" aria-hidden="true">
            {initials(user.fullName)}
          </span>
          <span className="prov-account__copy">
            <strong>{user.fullName}</strong>
            <small>{statusLabel}</small>
          </span>
        </div>
        <button
          type="button"
          className="prov-logout"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <span className="auth-spinner" aria-hidden="true" />
          ) : (
            <LogOutIcon size={14} />
          )}
          <span>{loggingOut ? 'Keluar…' : 'Keluar'}</span>
        </button>
      </div>
    </aside>
  )
}
