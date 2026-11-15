import type { Metadata } from 'next'
import { PaymentVerificationQueueClient } from '@/components/admin/payments/PaymentVerificationQueueClient'
import './verification.css'

export const metadata: Metadata = {
  title: 'Antrean Verifikasi Pembayaran — Admin LOKA',
  description: 'Pantau pembayaran yang membutuhkan pemeriksaan di LOKA.',
}

export default function PaymentVerificationPage() {
  return <PaymentVerificationQueueClient />
}
