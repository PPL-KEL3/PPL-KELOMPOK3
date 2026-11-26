'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { ApiError, bookingApi } from '@/lib/api'
import { formatBookingDate } from '@/lib/booking-utils'
import type { BookingDetailData } from '@/types/booking'
import { AlertIcon, CalendarIcon, RefreshIcon } from '@/components/ui/AuthIcons'
import { useToast } from '@/components/ui/ToastProvider'

const STATUS_LABELS: Record<string, string> = {
  pending_provider_confirmation: 'Menunggu konfirmasi',
  accepted: 'Diterima',
  cancelled: 'Dibatalkan',
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

function CustomerInitials({ name }: { name: string }) {
  const value = name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
  return <span className="provider-booking__avatar" aria-hidden="true">{value || 'CU'}</span>
}

export function ProviderBookingsClient() {
  const [bookings, setBookings] = useState<BookingDetailData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | BookingDetailData['status']>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const toast = useToast()

  const loadBookings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await bookingApi.listIncoming()
      setBookings(result.bookings)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Daftar pesanan gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadBookings() }, [loadBookings])

  const visibleBookings = useMemo(() => {
    return [...bookings]
      .filter((booking) => statusFilter === 'all' || booking.status === statusFilter)
      .sort((first, second) => {
        const difference = new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()
        return sortOrder === 'newest' ? -difference : difference
      })
  }, [bookings, sortOrder, statusFilter])

  async function changeBookingStatus(booking: BookingDetailData, action: 'accept' | 'reject') {
    if (actionId) return
    if (action === 'reject' && !window.confirm('Tolak pesanan dari customer ini?')) return
    setActionId(booking.id)
    try {
      const result = action === 'accept'
        ? await bookingApi.accept(booking.id)
        : await bookingApi.reject(booking.id)
      setBookings((current) => current.map((item) => item.id === booking.id ? result.booking : item))
      toast.success(action === 'accept' ? 'Booking berhasil diterima.' : 'Booking berhasil ditolak.')
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Status booking gagal diperbarui.')
    } finally {
      setActionId(null)
    }
  }

  return (
    <DashboardShell
      eyebrow="Pesanan Masuk"
      title="Kenali customer yang mempercayakan pekerjaannya kepadamu."
      description="Lihat seluruh pemesanan yang masuk untuk jasa kamu, termasuk jadwal pengerjaan, layanan, dan status konfirmasinya."
    >
      <section className="provider-bookings" aria-labelledby="provider-bookings-title">
        <div className="provider-bookings__heading">
          <div>
            <span className="dash-card__eyebrow">Daftar pemesanan</span>
            <h2 id="provider-bookings-title">Customer yang memesan jasa</h2>
          </div>
          <button type="button" className="provider-bookings__refresh" onClick={() => void loadBookings()} disabled={loading}>
            <RefreshIcon size={15} /> {loading ? 'Memuat...' : 'Muat ulang'}
          </button>
        </div>

        <div className="provider-bookings__filters" aria-label="Filter pesanan">
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">Semua status</option>
              <option value="pending_provider_confirmation">Menunggu konfirmasi</option>
              <option value="accepted">Diterima</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </label>
          <label>
            <span>Urutkan</span>
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}>
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
            </select>
          </label>
          <span className="provider-bookings__count">{visibleBookings.length} pesanan</span>
        </div>

        {loading && <div className="provider-bookings__state" role="status"><span className="auth-spinner auth-spinner--large" /><p>Memuat pesanan masuk...</p></div>}
        {!loading && error && <div className="provider-bookings__state provider-bookings__state--error" role="alert"><AlertIcon size={22} /><p>{error}</p><button type="button" onClick={() => void loadBookings()}>Coba lagi</button></div>}
        {!loading && !error && bookings.length === 0 && <div className="provider-bookings__state"><CalendarIcon size={30} /><h3>Belum ada pesanan masuk</h3><p>Pesanan customer akan muncul di sini setelah mereka memesan jasa kamu.</p></div>}
        {!loading && !error && bookings.length > 0 && visibleBookings.length === 0 && <div className="provider-bookings__state"><CalendarIcon size={30} /><h3>Tidak ada pesanan dengan filter ini</h3><p>Coba pilih status pesanan yang lain.</p></div>}
        {!loading && !error && visibleBookings.length > 0 && (
          <div className="provider-bookings__list">
            {visibleBookings.map((booking) => {
              const customerName = booking.customerName ?? 'Customer LOKA'
              return (
                <article className="provider-booking" key={booking.id}>
                  <div className="provider-booking__customer"><CustomerInitials name={customerName} /><div><strong>{customerName}</strong><span>Booking #{booking.id.slice(0, 8)}</span></div></div>
                  <dl className="provider-booking__details">
                    <div><dt>Jasa</dt><dd>{booking.serviceName}</dd></div>
                    <div><dt>Jadwal</dt><dd>{formatBookingDate(booking.workDate)} · {booking.workTime}</dd></div>
                    <div><dt>Paket / harga</dt><dd>{booking.packageName ?? 'Harga dasar jasa'} · {formatRupiah(booking.price)}</dd></div>
                  </dl>
                  <div className="provider-booking__actions">
                    <span className={`provider-booking__status provider-booking__status--${booking.status}`}>{STATUS_LABELS[booking.status] ?? booking.status}</span>
                    {booking.status === 'pending_provider_confirmation' && (
                      <div className="provider-booking__buttons">
                        <button type="button" className="provider-booking__button provider-booking__button--accept" disabled={actionId !== null} onClick={() => void changeBookingStatus(booking, 'accept')}>
                          {actionId === booking.id ? 'Memproses...' : 'Terima'}
                        </button>
                        <button type="button" className="provider-booking__button provider-booking__button--reject" disabled={actionId !== null} onClick={() => void changeBookingStatus(booking, 'reject')}>Tolak</button>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </DashboardShell>
  )
}
