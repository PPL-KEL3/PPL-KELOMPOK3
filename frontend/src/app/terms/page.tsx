import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { ArrowLeftIcon } from '@/components/ui/AuthIcons'

export const metadata: Metadata = {
  title: 'Ketentuan Layanan — LOKA',
}

export default function TermsPage() {
  return (
    <AuthLayout>
      <header className="auth-card__header">
        <p className="auth-card__eyebrow">Ketentuan Layanan</p>
        <h1>Ketentuan Penggunaan LOKA</h1>
        <p className="auth-card__subtitle">
          Ringkasan aturan dasar penggunaan platform LOKA.
        </p>
      </header>

      <div className="auth-legal-page">
        <p>
          LOKA menghubungkan masyarakat dengan penyedia jasa lokal. Pengguna wajib
          memberikan informasi yang benar, menjaga keamanan akun, dan menggunakan
          platform dengan itikad baik.
        </p>
        <p>
          Penyedia jasa bertanggung jawab atas keakuratan profil, layanan, harga, dan
          hasil pekerjaan yang ditawarkan. Customer bertanggung jawab atas informasi
          kebutuhan dan pembayaran yang disepakati.
        </p>
        <p>
          LOKA dapat meninjau, membatasi, atau menghentikan akun yang melanggar aturan,
          menyalahgunakan platform, atau memberikan informasi palsu.
        </p>
      </div>

      <Link href="/login" className="auth-back-link">
        <ArrowLeftIcon size={17} />
        Kembali ke Login
      </Link>
    </AuthLayout>
  )
}
