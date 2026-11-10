import type { Metadata } from 'next'
import { PublishedServicesCatalog } from '@/components/customer/PublishedServicesCatalog'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export const metadata: Metadata = {
  title: 'Dashboard Customer - LOKA',
}

export default function CustomerDashboardPage() {
  return (
    <DashboardShell
      eyebrow="Dashboard Customer"
      title="Selamat datang di ruang pelanggan LOKA."
      description="Temukan layanan dari penyedia jasa lokal terverifikasi di sekitarmu."
    >
      <section className="dash-grid">
        <article className="dash-card">
          <span className="dash-card__eyebrow">Status akun</span>
          <h2>Akun customer aktif</h2>
          <p>
            Kamu masuk melalui autentikasi LOKA dan role kamu dibaca langsung dari
            profil akun di server.
          </p>
        </article>

        <article className="dash-card">
          <span className="dash-card__eyebrow">Katalog Publik</span>
          <h2>Jelajahi jasa terpublikasi</h2>
          <p>
            Seluruh layanan aktif yang dipublikasikan oleh penyedia jasa
            terverifikasi ditampilkan pada katalog di bawah ini.
          </p>
        </article>
      </section>

      <PublishedServicesCatalog />
    </DashboardShell>
  )
}
