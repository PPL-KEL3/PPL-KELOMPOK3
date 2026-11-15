import type { Metadata } from 'next'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { FavoritesClient } from '@/components/customer/favorites/FavoritesClient'

export const metadata: Metadata = {
  title: 'Daftar Favorit Saya - LOKA',
  description: 'Kelola daftar jasa dan penyedia favorit Anda di LOKA.',
}

export default function CustomerFavoritesPage() {
  return (
    <DashboardShell
      eyebrow="Daftar Favorit"
      title="Layanan & Penyedia Jasa Favorit"
      description="Simpan jasa langganan dan profil penyedia terbaik agar mudah ditemukan kembali saat Anda membutuhkannya."
    >
      <FavoritesClient />
    </DashboardShell>
  )
}

