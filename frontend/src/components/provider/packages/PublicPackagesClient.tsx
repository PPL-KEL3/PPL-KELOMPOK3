'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { LokaLogo } from '@/components/ui/LokaLogo'
import {
  InfoIcon,
  PackageIcon,
  RefreshIcon,
  SparkIcon,
  XCircleIcon,
} from '@/components/ui/AuthIcons'
import { ApiError, packageApi } from '@/lib/api'
import type { PackageItem } from '@/types/package'
import { PackageList } from './PackageList'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; packages: PackageItem[] }
  | { status: 'not-found' }
  | { status: 'error'; message: string }

export function PublicPackagesClient({ serviceId }: { serviceId: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const result = await packageApi.listByService(serviceId)
      setState({ status: 'ready', packages: result.packages })
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.code === 'SERVICE_NOT_FOUND' || err.code === 'INVALID_SERVICE_ID')
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
  }, [serviceId])

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
        <span>
          Halaman demo sementara (TPR-5, AC2) · dihapus saat halaman detail jasa
          milik Vivi siap
        </span>
      </div>

      <main className="pkgpub-body">
        <section className="pkgpub-hero" aria-labelledby="pkgpub-hero-title">
          <span className="pkgpub-hero__tag">Paket &amp; Harga Jasa</span>
          <h1 id="pkgpub-hero-title">Daftar paket jasa ini</h1>
          <p>
            Bandingkan pilihan paket dan harganya sebelum memesan. Hanya paket
            aktif yang ditampilkan.
          </p>
        </section>

        {state.status === 'loading' && (
          <div className="pkgpub-grid" aria-busy="true" aria-label="Memuat paket">
            {[0, 1].map((key) => (
              <div key={key} className="pkgpub-card pkgpub-skeleton">
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        )}

        {state.status === 'not-found' && (
          <StatePanel
            tag="Jasa tidak ditemukan"
            icon={<XCircleIcon size={26} />}
            title="Jasa tidak ditemukan."
            text="Jasa mungkin sudah dinonaktifkan atau dihapus oleh penyedia."
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
            title="Gagal memuat daftar paket."
            text={state.message}
            action={
              <button type="button" className="pkgpub-btn" onClick={() => void load()}>
                <RefreshIcon size={16} />
                <span>Coba lagi</span>
              </button>
            }
          />
        )}

        {state.status === 'ready' && state.packages.length === 0 && (
          <StatePanel
            tag="Belum ada paket aktif"
            icon={<PackageIcon size={26} />}
            title="Jasa ini belum punya paket aktif."
            text="Penyedia belum menampilkan paket untuk jasa ini. Kamu tetap bisa melihat jasa lain di direktori."
            action={
              <Link href="/" className="pkgpub-btn">
                Cari Jasa Lain
              </Link>
            }
          />
        )}

        {state.status === 'ready' && state.packages.length > 0 && (
          <>
            <div className="pkgpub-section-head">
              <div>
                <span className="pkgpub-eyebrow">Pilihan Paket</span>
                <h2>Pilih paket yang sesuai kebutuhanmu</h2>
              </div>
              <span className="pkgpub-sort">Diurutkan dari harga termurah</span>
            </div>

            <PackageList packages={state.packages} />

            <div className="pkgpub-note">
              <SparkIcon size={15} />
              <span>
                Harga bisa dilihat tanpa login. Untuk memesan, kamu diminta masuk
                dulu. Paket nonaktif tidak ditampilkan.
              </span>
            </div>
          </>
        )}
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
