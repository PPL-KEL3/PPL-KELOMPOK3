import type { Metadata } from 'next'
import { PublicProviderProfileClient } from '@/components/customer/PublicProviderProfileClient'
import './providers.css'

export const metadata: Metadata = {
  title: 'Profil Penyedia — LOKA',
  description:
    'Kenali penyedia jasa lokal LOKA, lihat layanan yang ditawarkan, dan hubungi melalui WhatsApp.',
}

export default async function PublicProviderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <PublicProviderProfileClient providerId={id} />
}
