import type { Metadata } from 'next'
import { BookingDetailClient } from '@/components/customer/booking/BookingDetailClient'
import { RoleGate } from '@/components/auth/RoleGate'
import '../booking.css'

export const metadata: Metadata = { title: 'Detail Pemesanan - LOKA' }

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RoleGate role="customer"><BookingDetailClient bookingId={id} /></RoleGate>
}
