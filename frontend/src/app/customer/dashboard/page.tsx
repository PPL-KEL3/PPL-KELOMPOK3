import type { Metadata } from 'next'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export const metadata: Metadata = {
  title: 'Dashboard Customer — LOKA',
}

export default function CustomerDashboardPage() {
  return (
    <DashboardShell
      eyebrow="Dashboard Customer"
      title="Selamat datang di ruang pelanggan LOKA."
      description="Akun kamu aktif dan siap digunakan untuk mencari penyedia jasa lokal. Fitur pencarian, booking, dan pembayaran akan tersedia pada tahap pengembangan berikutnya."
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
          <span className="dash-card__eyebrow">Apa berikutnya?</span>
          <h2>Jelajahi potensi sekitar</h2>
          <p>
            Kembali ke beranda untuk mengenal LOKA lebih dekat. Halaman dashboard ini
            akan diisi dengan fitur customer pada sprint berikutnya.
          </p>
        </article>
      </section>
    </DashboardShell>
  )
}
