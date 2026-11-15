import type { Metadata } from 'next'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PublishedServicesCatalog } from '@/components/customer/PublishedServicesCatalog'

export const metadata: Metadata = {
  title: 'Cari Jasa - LOKA',
}

export default function CustomerServicesPage() {
  return (
    <DashboardShell
      eyebrow="Direktori Layanan"
      title="Cari jasa yang kamu butuhkan."
      description="Temukan layanan dari penyedia jasa lokal terverifikasi di sekitarmu."
    >
      <PublishedServicesCatalog />
    </DashboardShell>
  )
}
