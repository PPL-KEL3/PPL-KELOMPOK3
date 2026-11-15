import type { Metadata } from 'next'
import { FavoritesClient } from '@/components/customer/favorites/FavoritesClient'

export const metadata: Metadata = {
  title: 'Daftar Favorit Saya - LOKA',
  description: 'Kelola daftar jasa dan penyedia favorit Anda di LOKA.',
}

export default function CustomerFavoritesPage() {
  return (
    <main style={{ padding: '24px 32px', maxWidth: '1280px', margin: '0 auto' }}>
      <FavoritesClient />
    </main>
  )
}
