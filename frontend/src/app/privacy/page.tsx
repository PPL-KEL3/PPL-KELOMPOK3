import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { ArrowLeftIcon } from '@/components/ui/AuthIcons'

export const metadata: Metadata = {
  title: 'Kebijakan Privasi — LOKA',
}

export default function PrivacyPage() {
  return (
    <AuthLayout>
      <header className="auth-card__header">
        <p className="auth-card__eyebrow">Kebijakan Privasi</p>
        <h1>Bagaimana LOKA Menjaga Data Kamu</h1>
        <p className="auth-card__subtitle">
          Ringkasan penggunaan data untuk menjalankan layanan autentikasi dan profil.
        </p>
      </header>

      <div className="auth-legal-page">
        <p>
          LOKA menyimpan data akun dasar seperti nama, alamat email, role, dan status
          verifikasi penyedia jasa untuk menjalankan layanan dan mengamankan akses.
        </p>
        <p>
          Sesi login disimpan dalam cookie yang tidak dapat dibaca oleh JavaScript di
          browser. Role akun tidak disimpan di localStorage dan selalu diverifikasi
          ulang oleh backend.
        </p>
        <p>
          Kami tidak menampilkan data sensitif melalui pesan error, dan tidak
          menyimpan service role key pada aplikasi frontend.
        </p>
      </div>

      <Link href="/login" className="auth-back-link">
        <ArrowLeftIcon size={17} />
        Kembali ke Login
      </Link>
    </AuthLayout>
  )
}
