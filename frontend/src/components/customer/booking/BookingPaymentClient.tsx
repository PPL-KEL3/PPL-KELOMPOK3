'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertIcon, ArrowLeftIcon, InfoIcon, ShieldIcon } from '@/components/ui/AuthIcons'
import { ApiError, bookingApi, type PaymentData } from '@/lib/api'
import { formatBookingDate } from '@/lib/booking-utils'
import { formatRupiah } from '@/data/mock-services'
import type { BookingDetailData } from '@/types/booking'

const QRIS_IMAGE_URL = process.env.NEXT_PUBLIC_QRIS_IMAGE_URL

export function BookingPaymentClient({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState<BookingDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payment, setPayment] = useState<PaymentData | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!payment || payment.status === 'paid' || payment.sessionStatus !== 'active') return
    const interval = window.setInterval(async () => {
      try {
        const result = await bookingApi.refreshPayment(bookingId)
        setPayment(result.payment)
      } catch {
        // Refresh manual tetap tersedia jika polling gagal.
      }
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [bookingId, payment])

  async function refreshStatus() {
    setActionLoading(true)
    setActionError(null)
    try {
      const result = await bookingApi.refreshPayment(bookingId)
      setPayment(result.payment)
    } catch (reason: unknown) {
      setActionError(reason instanceof ApiError ? reason.message : 'Status pembayaran gagal diperbarui.')
    } finally {
      setActionLoading(false)
    }
  }

  async function regenerateSession() {
    setActionLoading(true)
    setActionError(null)
    try {
      const result = await bookingApi.regeneratePayment(bookingId)
      setPayment(result.payment)
    } catch (reason: unknown) {
      setActionError(reason instanceof ApiError ? reason.message : 'Sesi pembayaran gagal dibuat ulang.')
    } finally {
      setActionLoading(false)
    }
  }

  async function cancelSession() {
    if (!window.confirm('Batalkan sesi pembayaran ini? Sesi lokal yang aktif tidak akan dapat digunakan lagi.')) return
    setActionLoading(true)
    setActionError(null)
    try {
      const result = await bookingApi.cancelPayment(bookingId)
      setPayment(result.payment)
    } catch (reason: unknown) {
      setActionError(reason instanceof ApiError ? reason.message : 'Sesi pembayaran gagal dibatalkan.')
    } finally {
      setActionLoading(false)
    }
  }

  async function confirmDemoPayment() {
    if (!window.confirm('Konfirmasi pembayaran simulasi? Status pembayaran akan berubah menjadi lunas.')) return
    setActionLoading(true)
    setActionError(null)
    try {
      const result = await bookingApi.confirmDemoPayment(bookingId)
      setPayment(result.payment)
    } catch (reason: unknown) {
      setActionError(reason instanceof ApiError ? reason.message : 'Pembayaran simulasi gagal dikonfirmasi.')
    } finally {
      setActionLoading(false)
    }
  }

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
            <div className="payment-status-row"><span className={`booking-status ${payment?.status === 'paid' ? 'payment-status--paid' : payment?.sessionStatus === 'expired' ? 'payment-status--expired' : payment?.sessionStatus === 'cancelled' ? 'payment-status--cancelled' : 'payment-status--unpaid'}`}>{payment?.status === 'paid' ? 'Pembayaran Terbayar' : payment?.sessionStatus === 'expired' ? 'Sesi Kedaluwarsa' : payment?.sessionStatus === 'cancelled' ? 'Sesi Dibatalkan' : 'Belum Dibayar'}</span></div>
             <div className="payment-qr-empty" role="status">
               {QRIS_IMAGE_URL && payment?.status !== 'paid' && payment?.sessionStatus === 'active' ? <img className="payment-qr-image" src={QRIS_IMAGE_URL} alt="QRIS pembayaran LOKA" /> : <span className="payment-qr-placeholder" aria-hidden="true"><ShieldIcon size={34} /></span>}
               <h2 id="payment-session-title">Pembayaran QRIS lokal</h2>
               <p>{payment?.status === 'paid' ? 'Pembayaran untuk booking ini sudah ditandai terbayar oleh administrator.' : payment?.sessionStatus === 'expired' ? 'Sesi pembayaran sudah kedaluwarsa dan tidak dapat digunakan lagi.' : payment?.sessionStatus === 'cancelled' ? 'Sesi pembayaran ini sudah dibatalkan.' : QRIS_IMAGE_URL ? 'Pindai QRIS di atas menggunakan aplikasi pembayaran kamu, lalu tunggu admin mengonfirmasi pembayaran.' : 'QRIS merchant belum dikonfigurasi. Admin tetap dapat memverifikasi pembayaran secara manual setelah QRIS merchant tersedia.'}</p>
               {!QRIS_IMAGE_URL && <div className="payment-integration-note"><InfoIcon size={16} /><span>Tambahkan NEXT_PUBLIC_QRIS_IMAGE_URL berisi URL gambar QRIS merchant agar kode dapat ditampilkan.</span></div>}
              {payment && payment.status !== 'paid' && payment.sessionStatus === 'active' && <p className="payment-expiry">Sesi berlaku sampai {formatPaymentDate(payment.expiresAt)}</p>}
              {actionError && <p className="payment-action-error" role="alert">{actionError}</p>}
              <div className="payment-actions">
                 {payment && payment.status !== 'paid' && payment.sessionStatus === 'active' && <>
                   <button type="button" className="booking-primary payment-demo-button" onClick={confirmDemoPayment} disabled={actionLoading}>{actionLoading ? 'Memproses...' : 'Bayar Sekarang (Simulasi)'}</button>
                   <button type="button" className="booking-secondary" onClick={refreshStatus} disabled={actionLoading}>{actionLoading ? 'Memperbarui...' : 'Refresh Status'}</button>
                  <button type="button" className="booking-secondary payment-danger-button" onClick={cancelSession} disabled={actionLoading}>Batalkan Pembayaran</button>
                </>}
                {payment && payment.status !== 'paid' && payment.sessionStatus === 'expired' && <button type="button" className="booking-secondary" onClick={regenerateSession} disabled={actionLoading}>{actionLoading ? 'Membuat ulang...' : 'Buat Sesi Baru'}</button>}
              </div>
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

function formatPaymentDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function PaymentState({ title, text, loading = false }: { title: string; text: string; loading?: boolean }) {
  return <main className="booking-page"><div className="booking-state" role={loading ? 'status' : 'alert'}>{loading && <span className="auth-spinner auth-spinner--large" aria-hidden="true" />} {!loading && <span className="booking-state__icon"><AlertIcon size={28} /></span>}<h1>{title}</h1><p>{text}</p><Link href="/customer/dashboard" className="booking-secondary">Kembali ke dashboard</Link></div></main>
}
