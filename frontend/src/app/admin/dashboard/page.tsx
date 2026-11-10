import type { Metadata } from 'next'
import Link from 'next/link'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export const metadata: Metadata = {
  title: 'Dashboard Admin - LOKA',
}

export default function AdminDashboardPage() {
  return (
    <DashboardShell
      eyebrow="Dashboard Administrator"
      title="Ruang operasional LOKA."
      description="Kelola kategori direktori jasa, verifikasi penyedia jasa, dan pantau operasional platform LOKA."
    >
      <section className="dash-grid">
        <article className="dash-card">
          <span className="dash-card__eyebrow">Direktori Layanan</span>
          <h2>Manajemen Kategori Jasa</h2>
          <p>
            Tambah, perbarui, dan hapus kategori jasa agar layanan penyedia
            tersusun rapi dan mudah ditemukan pelanggan.
          </p>
          <div style={{ marginTop: '16px' }}>
            <Link
              href="/admin/categories"
              className="dash-logout"
              style={{ display: 'inline-flex', textDecoration: 'none' }}
            >
              Buka Manajemen Kategori
            </Link>
          </div>
        </article>

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
