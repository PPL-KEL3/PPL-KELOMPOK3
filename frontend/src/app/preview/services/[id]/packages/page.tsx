import type { Metadata } from 'next'
import { PublicPackagesClient } from '@/components/provider/packages/PublicPackagesClient'
import './preview.css'

export const metadata: Metadata = {
  title: 'Paket & Harga Jasa - LOKA',
  description: 'Lihat pilihan paket dan harga jasa lokal di LOKA.',
}

// Halaman demo sementara untuk AC2 TPR-5. Dihapus saat halaman detail jasa permanen tersedia.
export default async function PreviewServicePackagesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PublicPackagesClient serviceId={id} />
}
