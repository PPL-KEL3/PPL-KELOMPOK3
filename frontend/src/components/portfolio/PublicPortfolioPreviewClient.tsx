'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { LokaLogo } from '@/components/ui/LokaLogo'
import { ImageIcon, InfoIcon, RefreshIcon, XCircleIcon } from '@/components/ui/AuthIcons'
import { ApiError, portfolioApi } from '@/lib/api'
import type { PortfolioItem } from '@/types/portfolio'
import { PublicPortfolioGallery } from './PublicPortfolioGallery'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; items: PortfolioItem[] }
  | { status: 'not-found' }
  | { status: 'error'; message: string }

/**
 * Halaman demo AC2 TPR-6. Header sengaja netral (tanpa nama penyedia), karena endpoint
 * publik hanya mengembalikan item dan anon tidak boleh membaca `profiles`.
 */
export function PublicPortfolioPreviewClient({ providerId }: { providerId: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const result = await portfolioApi.listByProvider(providerId)
      setState({ status: 'ready', items: result.items })
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.code === 'PROVIDER_NOT_FOUND' || err.code === 'INVALID_PROVIDER_ID')
      ) {
        setState({ status: 'not-found' })
        return
      }
      setState({
        status: 'error',
        message:
          err instanceof ApiError && err.status !== 0
            ? err.message
            : 'Tidak dapat terhubung ke server. Coba lagi.',
      })
    }
  }, [providerId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="pkgpub-page">
      <header className="pkgpub-nav">
        <LokaLogo />
        <nav className="pkgpub-nav__links" aria-label="Navigasi halaman publik">
          <Link href="/">Beranda</Link>
          <Link href="/login" className="pkgpub-nav__login">
            Masuk
          </Link>
          <Link href="/register" className="pkgpub-nav__register">
            Daftar
          </Link>
        </nav>
      </header>

      <div className="pkgpub-demo" role="note">
        <InfoIcon size={15} />
        <span>Halaman pratinjau portofolio penyedia jasa</span>
      </div>

      <main className="pkgpub-body">
        <section className="pkgpub-hero" aria-labelledby="pfpub-hero-title">
          <span className="pkgpub-hero__tag">Portofolio Penyedia Jasa</span>
          <h1 id="pfpub-hero-title">Galeri hasil pekerjaan</h1>
          <p>
            Lihat contoh hasil kerja penyedia ini sebelum memesan. Foto terbaru
            tampil paling atas.
          </p>
        </section>

        {state.status === 'loading' && (
          <div className="pfpub-loading" aria-busy="true" aria-label="Memuat portofolio">
            {[0, 1, 2].map((key) => (
              <span key={key} className="pfpub-loading__tile" />
            ))}
          </div>
        )}

        {state.status === 'not-found' && (
          <StatePanel
            tag="Penyedia tidak ditemukan"
            icon={<XCircleIcon size={26} />}
            title="Penyedia jasa tidak ditemukan."
            text="Tautan mungkin salah, atau akun ini bukan penyedia jasa."
            action={
              <Link href="/" className="pkgpub-btn">
                Kembali ke Beranda
              </Link>
            }
          />
        )}

        {state.status === 'error' && (
          <StatePanel
            tag="Gagal memuat"
            icon={<XCircleIcon size={26} />}
            title="Gagal memuat portofolio."
            text={state.message}
            action={
              <button type="button" className="pkgpub-btn" onClick={() => void load()}>
                <RefreshIcon size={16} />
                <span>Coba lagi</span>
              </button>
            }
          />
        )}

        {state.status === 'ready' && state.items.length === 0 && (
          <StatePanel
            tag="Belum ada portofolio"
            icon={<ImageIcon size={26} />}
            title="Penyedia ini belum menambahkan portofolio."
            text="Foto hasil kerja akan tampil di sini setelah penyedia mengunggahnya."
            action={
              <Link href="/" className="pkgpub-btn">
                Cari Jasa Lain
              </Link>
            }
          />
        )}

        {state.status === 'ready' && <PublicPortfolioGallery items={state.items} />}
      </main>
    </div>
  )
}

interface StatePanelProps {
  tag: string
  icon: ReactNode
  title: string
  text: string
  action: ReactNode
}

function StatePanel({ tag, icon, title, text, action }: StatePanelProps) {
  return (
    <div className="pkgpub-state" role="status">
      <span className="pkgpub-state__tag">{tag}</span>
      <span className="pkgpub-state__icon" aria-hidden="true">
        {icon}
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  )
}
