'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertIcon, ArrowLeftIcon, InfoIcon } from '@/components/ui/AuthIcons'
import { ApiError, bookingApi, reviewsApi, type BookingRequirementsResult } from '@/lib/api'
import { formatBookingDate } from '@/lib/booking-utils'
import { formatRupiah } from '@/data/mock-services'
import type { BookingDetailData } from '@/types/booking'
import type { ReviewItem } from '@/types/review'
import { useToast } from '@/components/ui/ToastProvider'
import { BookingRequirementsCard } from './BookingRequirementsCard'
import { ReviewFormModal } from '@/components/customer/reviews/ReviewFormModal'

/**
 * Endpoint detail booking belum tersedia di backend TPR-74. Komponen ini
 * sengaja tidak membuat data booking palsu atau menampilkan sukses semu.
 */
export function BookingDetailClient({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState<BookingDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [requirements, setRequirements] = useState<BookingRequirementsResult['requirements']>(null)
  const [existingReview, setExistingReview] = useState<ReviewItem | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    bookingApi.getById(bookingId).then(async (result) => {
      if (cancelled) return
      setBooking(result.booking)
      try {
        const requirementResult = await bookingApi.getRequirements(bookingId)
        if (!cancelled) setRequirements(requirementResult.requirements)
      } catch {
        // Booking tanpa requirements adalah kondisi valid; jangan menutupi detail booking.
        if (!cancelled) setRequirements(null)
      }
      try {
        const reviewRes = await reviewsApi.getReviewByBooking(bookingId)
        if (!cancelled) setExistingReview(reviewRes.review)
      } catch {
        // Abaikan jika belum ada review
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof ApiError ? reason.message : 'Detail booking gagal dimuat.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [bookingId])

  if (loading) return <main className="booking-page"><div className="booking-state" role="status"><span className="auth-spinner auth-spinner--large" aria-hidden="true" /><h1>Memuat detail booking...</h1><p>Mohon tunggu sebentar.</p></div></main>
  if (error || !booking) return <main className="booking-page"><div className="booking-state" role="alert"><span className="booking-state__icon"><AlertIcon size={28} /></span><h1>Booking tidak ditemukan</h1><p>{error ?? 'Data booking tidak tersedia.'}</p><Link href="/customer/dashboard" className="booking-secondary"><ArrowLeftIcon size={15} />Dashboard Customer</Link></div></main>

  const statusLabel: Record<string, string> = {
    pending_provider_confirmation: 'Menunggu Konfirmasi Penyedia',
    accepted: 'Diterima Penyedia',
    cancelled: 'Dibatalkan',
  }
  const currentBooking = booking

  async function cancel() {
    if (cancelling || currentBooking.status !== 'pending_provider_confirmation') return
    if (!window.confirm('Batalkan booking ini?')) return
    setCancelling(true)
    try {
      const result = await bookingApi.cancel(currentBooking.id)
      setBooking(result.booking)
      toast.success('Booking berhasil dibatalkan.')
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Booking gagal dibatalkan.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <main className="booking-page">
      <div className="booking-page__inner">
        <Link href="/customer/dashboard" className="booking-back"><ArrowLeftIcon size={16} /> Kembali ke dashboard</Link>
        <header className="booking-page__hero"><span className="booking-eyebrow">Detail Pemesanan</span><h1>Detail Pemesanan</h1><p>Informasi booking yang tersimpan di LOKA.</p></header>
        <section className="booking-detail-card"><div className="booking-detail-card__header"><div><span className="booking-eyebrow">Booking #{booking.id.slice(0, 8)}</span><h2>{booking.serviceName}</h2></div><span className={`booking-status booking-status--${booking.status}`}>{statusLabel[booking.status] ?? booking.status}</span></div><dl className="booking-detail-list"><div><dt>Penyedia jasa</dt><dd>{booking.providerName}</dd></div><div><dt>Tanggal pengerjaan</dt><dd>{formatBookingDate(booking.workDate)}</dd></div><div><dt>Waktu pengerjaan</dt><dd>{booking.workTime}</dd></div><div><dt>Paket</dt><dd>{booking.packageName ?? 'Harga dasar jasa'}</dd></div><div><dt>Total harga</dt><dd>{formatRupiah(booking.price)}</dd></div><div><dt>Dibuat pada</dt><dd>{new Date(booking.createdAt).toLocaleString('id-ID')}</dd></div></dl>{booking.status === 'pending_provider_confirmation' && <p className="booking-detail-note"><InfoIcon size={16} />Booking sedang menunggu konfirmasi penyedia jasa.</p>}{booking.status === 'cancelled' && booking.cancellationReason && <p className="booking-detail-note booking-detail-note--cancelled"><AlertIcon size={16} />{booking.cancellationReason}</p>}{booking.status === 'pending_provider_confirmation' && <button type="button" className="booking-cancel" disabled={cancelling} onClick={() => void cancel()}>{cancelling ? 'Membatalkan...' : 'Batalkan Booking'}</button>}</section>
        <BookingRequirementsCard notes={requirements?.notes} photos={requirements?.attachments?.map((photo) => ({ id: photo.id, name: photo.fileName, size: photo.fileSize, url: photo.url }))} />
        {booking.status === 'accepted' && (
          <section
            style={{
              padding: '18px 20px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              marginTop: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span className="booking-eyebrow" style={{ color: 'var(--auth-primary, #245b45)' }}>Rating & Ulasan Layanan</span>
                <h3 style={{ margin: '4px 0', fontSize: '1.1rem', color: '#0f172a' }}>
                  {existingReview ? 'Ulasan Anda Telah Tersimpan' : 'Bagikan Pengalaman Anda'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  {existingReview
                    ? `Rating: ${existingReview.rating} Bintang ⭐ • "${existingReview.comment}"`
                    : 'Pesanan telah diterima. Beri rating dan masukan untuk membantu penyedia jasa.'}
                </p>
              </div>

              {!existingReview ? (
                <button
                  type="button"
                  onClick={() => setShowReviewModal(true)}
                  className="btn btn--primary"
                  style={{
                    backgroundColor: 'var(--auth-primary, #245b45)',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ⭐ Beri Ulasan Sekarang
                </button>
              ) : (
                <Link
                  href="/customer/reviews"
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--auth-primary, #245b45)',
                    fontWeight: 600,
                    textDecoration: 'underline',
                  }}
                >
                  Kelola Ulasan Saya →
                </Link>
              )}
            </div>
          </section>
        )}
        <Link href={`/customer/booking/${booking.id}/payment`} className="booking-secondary payment-detail-link">Lihat Pembayaran QRIS</Link>
      </div>

      <ReviewFormModal
        open={showReviewModal}
        bookingId={booking.id}
        serviceName={booking.serviceName}
        providerName={booking.providerName}
        submitting={submittingReview}
        onClose={() => setShowReviewModal(false)}
        onSubmit={async (payload) => {
          setSubmittingReview(true)
          try {
            const res = await reviewsApi.create(payload)
            setExistingReview(res.review)
            toast.success('Ulasan dan rating berhasil disimpan!')
            setShowReviewModal(false)
            return true
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Gagal mengirim ulasan.')
            return false
          } finally {
            setSubmittingReview(false)
          }
        }}
      />
    </main>
  )
}
