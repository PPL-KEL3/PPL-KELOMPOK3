import type { Metadata } from 'next'
import { RoleGate } from '@/components/auth/RoleGate'
import { BookingPaymentClient } from '@/components/customer/booking/BookingPaymentClient'
import '../../booking.css'
import './payment.css'

export const metadata: Metadata = { title: 'Pembayaran QRIS - LOKA' }

export default async function BookingPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RoleGate role="customer"><BookingPaymentClient bookingId={id} /></RoleGate>
}
