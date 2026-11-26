'use client'

import { useState, type ComponentType, type SVGProps } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { useToast } from '@/components/ui/ToastProvider'
import { LokaLogo } from '@/components/ui/LokaLogo'
import {
  LayoutDashboardIcon,
  LogOutIcon,
  ShieldIcon,
  BriefcaseIcon,
} from '@/components/ui/AuthIcons'

type NavIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

const ADMIN_NAV_ITEMS: Array<{ label: string; href: string; icon: NavIcon; match: 'exact' | 'prefix' }> = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboardIcon, match: 'exact' },
  { label: 'Kategori Jasa', href: '/admin/categories', icon: BriefcaseIcon, match: 'prefix' },
  { label: 'Verifikasi Pembayaran', href: '/admin/payments/verification', icon: ShieldIcon, match: 'prefix' },
]

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}

function isActive(pathname: string, item: (typeof ADMIN_NAV_ITEMS)[number]) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return item.match === 'exact' ? path === item.href : path === item.href || path.startsWith(`${item.href}/`)
}

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
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
    <aside className="prov-sidebar" aria-label="Navigasi administrator">
      <div className="prov-sidebar__top">
        <div className="prov-sidebar__logo"><LokaLogo /></div>
        <nav className="prov-nav" aria-label="Menu administrator">
          <p className="prov-nav__section">Administrator</p>
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item)
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className={`prov-nav__item${active ? ' prov-nav__item--active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
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
          <span className="prov-account__copy"><strong>{user.fullName}</strong><small>Administrator</small></span>
        </div>
        <button type="button" className="prov-logout" onClick={() => void handleLogout()} disabled={loggingOut}>
          {loggingOut ? <span className="auth-spinner" aria-hidden="true" /> : <LogOutIcon size={14} />}
          <span>{loggingOut ? 'Keluar…' : 'Keluar'}</span>
        </button>
      </div>
    </aside>
  )
}
