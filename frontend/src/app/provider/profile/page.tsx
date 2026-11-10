import type { Metadata } from 'next'
import { ProviderProfileClient } from '@/components/provider/profile/ProviderProfileClient'
import './profile.css'

export const metadata: Metadata = {
  title: 'Profil Penyedia — LOKA',
  description:
    'Kelola profil usaha, kontak WhatsApp, alamat, area layanan, dan jam operasional penyedia jasa LOKA.',
}

export default function ProviderProfilePage() {
  return <ProviderProfileClient />
}
