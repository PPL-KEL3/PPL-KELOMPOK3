'use client'

import { useState, type ComponentType, type SVGProps } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { useToast } from '@/components/ui/ToastProvider'
import { LokaLogo } from '@/components/ui/LokaLogo'
import { BriefcaseIcon, LayoutDashboardIcon, LogOutIcon } from '@/components/ui/AuthIcons'

type NavIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

const CUSTOMER_NAV_ITEMS: Array<{
  label: string
  href: string
  icon: NavIcon
  match: 'exact' | 'prefix'
}> = [
  { label: 'Dashboard', href: '/customer/dashboard', icon: LayoutDashboardIcon, match: 'exact' },
  { label: 'Cari Jasa', href: '/customer/services', icon: BriefcaseIcon, match: 'prefix' },
]

function isActive(pathname: string, href: string, match: 'exact' | 'prefix') {
  const cleanPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const cleanHref = href.split('#')[0]
  if (match === 'exact') return cleanPath === cleanHref
  return cleanPath === cleanHref || cleanPath.startsWith(`${cleanHref}/`)
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function CustomerSidebar({ onNavigate }: { onNavigate?: () => void }) {
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

  return (
    <aside className="prov-sidebar" aria-label="Navigasi customer">
      <div className="prov-sidebar__top">
        <div className="prov-sidebar__logo"><LokaLogo /></div>
        <nav className="prov-nav" aria-label="Menu customer">
          <p className="prov-nav__section">Pelanggan</p>
          {CUSTOMER_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href, item.match)
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
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="prov-account">
        <div className="prov-account__user">
          <span className="dash-avatar" aria-hidden="true">{initials(user.fullName)}</span>
          <span className="prov-account__copy">
            <strong>{user.fullName}</strong>
            <small>Customer</small>
          </span>
        </div>
        <button type="button" className="prov-logout" onClick={() => void handleLogout()} disabled={loggingOut}>
          {loggingOut ? <span className="auth-spinner" aria-hidden="true" /> : <LogOutIcon size={14} />}
          <span>{loggingOut ? 'Keluar…' : 'Keluar'}</span>
        </button>
      </div>
    </aside>
  )
}
