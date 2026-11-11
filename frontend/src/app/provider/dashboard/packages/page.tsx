import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PackageManagementClient } from '@/components/provider/packages/PackageManagementClient'
import './packages.css'

export const metadata: Metadata = {
  title: 'Paket & Harga Layanan - Penyedia LOKA',
  description:
    'Kelola paket dan harga untuk tiap jasa yang kamu tawarkan di LOKA.',
}

export default function ProviderPackagesPage() {
  return (
    <Suspense fallback={null}>
      <PackageManagementClient />
    </Suspense>
  )
}
