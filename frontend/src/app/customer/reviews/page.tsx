import type { Metadata } from 'next'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { CustomerReviewsClient } from '@/components/customer/reviews/CustomerReviewsClient'

export const metadata: Metadata = {
  title: 'Riwayat Ulasan Saya - LOKA',
  description: 'Kelola rating dan ulasan yang telah Anda berikan untuk layanan jasa di LOKA.',
}

export default function CustomerReviewsPage() {
  return (
    <DashboardShell
      eyebrow="Ulasan & Penilaian"
      title="Riwayat Rating & Ulasan"
      description="Kelola ulasan dan penilaian yang telah Anda berikan untuk layanan jasa yang pernah Anda pesan di LOKA."
    >
      <CustomerReviewsClient />
    </DashboardShell>
  )
}

