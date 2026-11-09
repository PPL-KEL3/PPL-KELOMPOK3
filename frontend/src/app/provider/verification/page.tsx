import type { Metadata } from 'next'
import ProviderVerificationClient from './ProviderVerificationClient'

export const metadata: Metadata = {
  title: 'Status Verifikasi — LOKA',
  description: 'Lihat status verifikasi akun penyedia jasa LOKA.',
}

export default function ProviderVerificationPage() {
  return <ProviderVerificationClient />
}
