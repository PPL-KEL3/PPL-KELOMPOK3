import type { Metadata } from 'next'
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
    />
  )
}
