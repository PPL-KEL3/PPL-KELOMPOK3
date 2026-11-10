import type { Metadata } from 'next'
import Link from 'next/link'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export const metadata: Metadata = {
  title: 'Dashboard Penyedia Jasa - LOKA',
}

export default function ProviderDashboardPage() {
  return (
    <DashboardShell
      eyebrow="Dashboard Penyedia Jasa"
      title="Keahlianmu sudah siap dikenal lebih luas."
      description="Akun penyedia jasa kamu sudah terverifikasi. Kelola daftar layanan, kategori, deskripsi, dan harga dasar agar pelanggan dapat menemukan jasa kamu."
    >
      <section className="dash-grid">
        <article className="dash-card">
          <span className="dash-card__eyebrow">Katalog Layanan</span>
          <h2>Manajemen Daftar Jasa</h2>
          <p>
            Tambahkan layanan baru, perbarui informasi dan harga dasar, atau
            nonaktifkan layanan yang sedang tidak ditawarkan.
          </p>
          <div style={{ marginTop: '16px' }}>
            <Link
              href="/provider/dashboard/services"
              className="dash-logout"
              style={{ display: 'inline-flex', textDecoration: 'none' }}
            >
              Kelola Daftar Jasa
            </Link>
          </div>
        </article>

        <article className="dash-card">
          <span className="dash-card__eyebrow">Status verifikasi</span>
          <h2>Terverifikasi</h2>
          <p>
            Kamu dapat mempublikasikan layanan secara normal. Status ini dibaca
            langsung dari profil akun di server.
          </p>
        </article>

        <article className="dash-card">
          <span className="dash-card__eyebrow">Keamanan akses</span>
          <h2>Hanya untuk penyedia jasa</h2>
          <p>
            Dashboard ini tidak dapat dibuka oleh customer atau admin. Setiap
            permintaan ke endpoint terlindungi juga diverifikasi ulang oleh
            backend.
          </p>
        </article>
      </section>
    </DashboardShell>
  )
}
