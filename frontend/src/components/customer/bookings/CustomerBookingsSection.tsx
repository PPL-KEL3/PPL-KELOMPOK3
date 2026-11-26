'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AlertIcon, CalendarIcon, RefreshIcon } from '@/components/ui/AuthIcons'
import { ApiError, bookingApi } from '@/lib/api'
import { formatBookingDate } from '@/lib/booking-utils'
import type { BookingDetailData } from '@/types/booking'

const STATUS_LABELS: Record<string, string> = {
  pending_provider_confirmation: 'Menunggu konfirmasi',
  accepted: 'Diterima',
  cancelled: 'Dibatalkan',
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

export function CustomerBookingsSection() {
  const [bookings, setBookings] = useState<BookingDetailData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBookings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await bookingApi.listMine()
      setBookings(result.bookings)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Daftar booking gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadBookings() }, [loadBookings])

  return (
    <section id="bookings" className="customer-bookings" aria-labelledby="customer-bookings-title">
      <div className="customer-bookings__heading">
        <div><span className="dash-card__eyebrow">Aktivitas customer</span><h2 id="customer-bookings-title">Pesanan Saya</h2><p>Daftar jasa yang pernah kamu pesan di LOKA.</p></div>
        <button type="button" className="customer-bookings__refresh" onClick={() => void loadBookings()} disabled={loading}><RefreshIcon size={15} /> {loading ? 'Memuat...' : 'Muat ulang'}</button>
      </div>
      {loading && <div className="customer-bookings__state" role="status"><span className="auth-spinner auth-spinner--large" /><p>Memuat pesanan kamu...</p></div>}
      {!loading && error && <div className="customer-bookings__state customer-bookings__state--error" role="alert"><AlertIcon size={22} /><p>{error}</p><button type="button" onClick={() => void loadBookings()}>Coba lagi</button></div>}
      {!loading && !error && bookings.length === 0 && <div className="customer-bookings__state"><CalendarIcon size={30} /><h3>Belum ada pesanan</h3><p>Pesanan jasa yang kamu buat akan muncul di sini.</p><Link href="/customer/services" className="customer-bookings__browse">Cari Jasa</Link></div>}
      {!loading && !error && bookings.length > 0 && <div className="customer-bookings__list">{bookings.map((booking) => <BookingRow key={booking.id} booking={booking} />)}</div>}
    </section>
  )
}

function BookingRow({ booking }: { booking: BookingDetailData }) {
  const status = STATUS_LABELS[booking.status] ?? booking.status
  return <article className="customer-booking-row">
    <div className="customer-booking-row__main"><span className="customer-booking-row__icon"><CalendarIcon size={18} /></span><div><strong>{booking.serviceName}</strong><span>{booking.providerName} · #{booking.id.slice(0, 8)}</span></div></div>
    <dl className="customer-booking-row__details"><div><dt>Jadwal</dt><dd>{formatBookingDate(booking.workDate)} · {booking.workTime}</dd></div><div><dt>Total</dt><dd>{formatRupiah(booking.price)}</dd></div></dl>
    <div className="customer-booking-row__actions"><span className={`customer-booking-status customer-booking-status--${booking.status}`}>{status}</span><div><Link href={`/customer/booking/${booking.id}`} className="customer-booking-row__link">Detail</Link>{booking.status === 'accepted' && <Link href={`/customer/booking/${booking.id}/payment`} className="customer-booking-row__link customer-booking-row__link--payment">QRIS</Link>}</div></div>
  </article>
}
