'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertIcon, ArrowLeftIcon, InfoIcon, ShieldIcon } from '@/components/ui/AuthIcons'
import { ApiError, bookingApi, type PaymentData } from '@/lib/api'
import { formatBookingDate } from '@/lib/booking-utils'
import { formatRupiah } from '@/data/mock-services'
import type { BookingDetailData } from '@/types/booking'

export function BookingPaymentClient({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState<BookingDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payment, setPayment] = useState<PaymentData | null>(null)

  useEffect(() => {
    let cancelled = false
    bookingApi.getById(bookingId).then(async (result) => {
      if (cancelled) return
      setBooking(result.booking)
      try {
        const paymentResult = await bookingApi.createPayment(bookingId)
        if (!cancelled) setPayment(paymentResult.payment)
      } catch (reason: unknown) {
        if (!cancelled) setError(reason instanceof ApiError ? reason.message : 'Data pembayaran gagal dimuat.')
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof ApiError ? reason.message : 'Detail pembayaran gagal dimuat.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [bookingId])

  if (loading) return <PaymentState title="Memuat pembayaran..." text="Kami sedang memuat informasi tagihan booking kamu." loading />
  if (error || !booking) return <PaymentState title="Pembayaran tidak dapat dimuat" text={error ?? 'Booking tidak ditemukan.'} />

  return (
    <main className="booking-page payment-page">
      <div className="booking-page__inner">
        <Link href={`/customer/booking/${booking.id}`} className="booking-back"><ArrowLeftIcon size={16} /> Kembali ke detail booking</Link>
        <header className="booking-page__hero payment-hero">
          <span className="booking-eyebrow">Pembayaran</span>
          <h1>Pembayaran QRIS</h1>
          <p>Selesaikan pembayaran layanan kamu dengan memindai kode QRIS.</p>
        </header>

        <div className="payment-layout">
          <section className="payment-qr-card" aria-labelledby="payment-session-title">
            <div className="payment-status-row"><span className={`booking-status ${payment?.status === 'paid' ? 'payment-status--paid' : 'payment-status--unpaid'}`}>{payment?.status === 'paid' ? 'Pembayaran Terbayar' : 'Belum Dibayar'}</span></div>
            <div className="payment-qr-empty" role="status">
              <span className="payment-qr-placeholder" aria-hidden="true"><ShieldIcon size={34} /></span>
              <h2 id="payment-session-title">Pembayaran QRIS lokal</h2>
              <p>{payment?.status === 'paid' ? 'Pembayaran untuk booking ini sudah ditandai terbayar oleh administrator.' : 'Pembayaran QRIS belum ditandai terbayar. Halaman ini hanya mencatat status pembayaran lokal dan belum terhubung ke gateway.'}</p>
              <div className="payment-integration-note"><InfoIcon size={16} /><span>Tidak ada kode QR yang dapat dipindai. Status pembayaran hanya dapat diperbarui dari backend oleh administrator.</span></div>
            </div>
          </section>

          <aside className="payment-summary-card" aria-labelledby="payment-summary-title">
            <div className="booking-eyebrow">Ringkasan tagihan</div>
            <h2 id="payment-summary-title">Informasi Booking</h2>
            <dl className="payment-summary-list">
              <div><dt>Booking</dt><dd>#{booking.id.slice(0, 8)}</dd></div>
              <div><dt>Jasa</dt><dd>{booking.serviceName}</dd></div>
              <div><dt>Penyedia</dt><dd>{booking.providerName}</dd></div>
              <div><dt>Tanggal</dt><dd>{formatBookingDate(booking.workDate)}</dd></div>
              <div><dt>Waktu</dt><dd>{booking.workTime}</dd></div>
              <div><dt>Status booking</dt><dd>{booking.status === 'accepted' ? 'Diterima Penyedia' : booking.status === 'cancelled' ? 'Dibatalkan' : 'Menunggu Konfirmasi'}</dd></div>
            </dl>
            <div className="payment-total"><span>Total dari booking</span><strong>{formatRupiah(booking.price)}</strong></div>
            <p className="payment-summary-note"><InfoIcon size={14} />Nominal ini berasal dari snapshot harga booking. Biaya gateway, diskon, dan status transaksi belum tersedia dari API payment.</p>
          </aside>
        </div>
      </div>
    </main>
  )
}

function PaymentState({ title, text, loading = false }: { title: string; text: string; loading?: boolean }) {
  return <main className="booking-page"><div className="booking-state" role={loading ? 'status' : 'alert'}>{loading && <span className="auth-spinner auth-spinner--large" aria-hidden="true" />} {!loading && <span className="booking-state__icon"><AlertIcon size={28} /></span>}<h1>{title}</h1><p>{text}</p><Link href="/customer/dashboard" className="booking-secondary">Kembali ke dashboard</Link></div></main>
}
