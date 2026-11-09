import type { Metadata } from 'next'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export const metadata: Metadata = {
  title: 'Dashboard Admin — LOKA',
}

export default function AdminDashboardPage() {
  return (
    <DashboardShell
      eyebrow="Dashboard Administrator"
      title="Ruang operasional LOKA."
      description="Akun admin hanya dapat diberikan oleh pihak yang berwenang. Pengelolaan kategori, verifikasi penyedia jasa, dan pemantauan aktivitas akan tersedia pada tahap pengembangan berikutnya."
    >
      <section className="dash-grid">
        <article className="dash-card">
          <span className="dash-card__eyebrow">Kontrol akses</span>
          <h2>Area terbatas</h2>
          <p>
            Customer dan penyedia jasa tidak dapat membuka dashboard ini, termasuk
            dengan mengubah URL. Backend memverifikasi role admin pada setiap permintaan.
          </p>
        </article>

        <article className="dash-card">
          <span className="dash-card__eyebrow">Akun admin</span>
          <h2>Dibuat secara terkontrol</h2>
          <p>
            Registrasi publik tidak menyediakan pilihan admin. Akun admin diberikan
            secara manual oleh operator yang berwenang melalui proses internal.
          </p>
        </article>
      </section>
    </DashboardShell>
  )
}
