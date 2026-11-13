'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { LokaLogo } from '@/components/ui/LokaLogo'
import { CloseIcon, MenuIcon } from '@/components/ui/AuthIcons'
import { CustomerSidebar } from './CustomerSidebar'
import { ProviderSidebarProvider } from '@/components/provider/ProviderSidebarContext'

const MOBILE_QUERY = '(max-width: 900px)'

export function CustomerSidebarLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    menuButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    const media = window.matchMedia(MOBILE_QUERY)
    function onMediaChange(event: MediaQueryListEvent) {
      if (!event.matches) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    media.addEventListener('change', onMediaChange)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      media.removeEventListener('change', onMediaChange)
    }
  }, [open, close])

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!open || event.key !== 'Tab' || !drawerRef.current) return
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <ProviderSidebarProvider value>
      <div className="prov-layout">
        <div id="customer-drawer" ref={drawerRef} className={`prov-drawer${open ? ' prov-drawer--open' : ''}`} onKeyDown={trapFocus}>
          <CustomerSidebar onNavigate={close} />
          <button ref={closeButtonRef} type="button" className="prov-drawer__close" aria-label="Tutup menu" onClick={close}>
            <CloseIcon size={20} />
          </button>
        </div>
        <div className={`prov-overlay${open ? ' prov-overlay--open' : ''}`} aria-hidden="true" onClick={close} />
        <div className="prov-content" inert={open}>
          <header className="prov-topbar">
            <LokaLogo />
            <button ref={menuButtonRef} type="button" className="prov-menu-button" aria-label="Buka menu" aria-expanded={open} aria-controls="customer-drawer" onClick={() => setOpen(true)}>
              <MenuIcon size={20} />
            </button>
          </header>
          {children}
        </div>
      </div>
    </ProviderSidebarProvider>
  )
}
