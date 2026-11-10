import type { Metadata } from 'next'
import { ServiceManagementClient } from '@/components/provider/services/ServiceManagementClient'
import './services.css'

export const metadata: Metadata = {
  title: 'Manajemen Layanan Jasa - Penyedia LOKA',
  description:
    'Kelola daftar layanan jasa, kategori, deskripsi, dan harga dasar yang kamu tawarkan di LOKA.',
}

export default function ProviderServicesPage() {
  return <ServiceManagementClient />
}

