import type { Metadata } from 'next'
import { BookingFormClient } from '@/components/customer/booking/BookingFormClient'
import { RoleGate } from '@/components/auth/RoleGate'
import '../booking.css'

export const metadata: Metadata = { title: 'Buat Pemesanan Jasa - LOKA' }

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ serviceId?: string }> }) {
  const { serviceId } = await searchParams
  return <RoleGate role="customer"><BookingFormClient serviceId={serviceId ?? ''} /></RoleGate>
}
