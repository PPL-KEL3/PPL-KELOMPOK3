'use client'

import Link from 'next/link'
import { AlertIcon, ArrowLeftIcon, InfoIcon } from '@/components/ui/AuthIcons'

/**
 * Endpoint detail booking belum tersedia di backend TPR-74. Komponen ini
 * sengaja tidak membuat data booking palsu atau menampilkan sukses semu.
 */
export function BookingDetailClient({ bookingId }: { bookingId: string }) {
  return (
    <main className="booking-page">
      <div className="booking-state" role="status">
        <span className="booking-state__icon"><InfoIcon size={28} /></span>
        <span className="booking-eyebrow">Detail Pemesanan</span>
        <h1>Detail booking belum tersedia</h1>
        <p>Data booking <strong>{bookingId}</strong> belum dapat dimuat karena endpoint booking TPR-74 belum tersedia.</p>
        <p className="booking-state__hint"><AlertIcon size={15} />Tidak ada data contoh yang ditampilkan agar informasi booking tidak menyesatkan.</p>
        <div className="booking-state__actions"><Link href="/customer/dashboard" className="booking-secondary"><ArrowLeftIcon size={15} />Dashboard Customer</Link></div>
      </div>
    </main>
  )
}
