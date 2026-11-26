import type { Metadata } from 'next'
import { ProviderBookingsClient } from '@/components/provider/bookings/ProviderBookingsClient'
import './bookings.css'

export const metadata: Metadata = {
  title: 'Pesanan Masuk - LOKA',
  description: 'Lihat daftar customer yang memesan jasa dari penyedia jasa LOKA.',
}

export default function ProviderBookingsPage() {
  return <ProviderBookingsClient />
}
