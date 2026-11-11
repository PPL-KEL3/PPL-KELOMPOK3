import type { Metadata } from 'next'
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
      <h2 className="prov-section-label">Status &amp; keamanan akun</h2>
      <section className="dash-grid">
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
