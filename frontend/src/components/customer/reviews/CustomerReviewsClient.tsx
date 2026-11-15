'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'
import { useReviews } from '@/hooks/useReviews'
import { ReviewCard } from '@/components/customer/reviews/ReviewCard'
import { EditReviewModal } from '@/components/customer/reviews/EditReviewModal'
import { DeleteReviewDialog } from '@/components/customer/reviews/DeleteReviewDialog'
import type { ReviewItem } from '@/types/review'

export function CustomerReviewsClient() {
  const { user } = useAuth()
  const { myReviews, loading, error, editReview, removeReview, refreshMine } = useReviews()

  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null)
  const [deletingReview, setDeletingReview] = useState<ReviewItem | null>(null)
  const [modalSubmitting, setModalSubmitting] = useState(false)

  async function handleConfirmDelete(review: ReviewItem) {
    setModalSubmitting(true)
    const ok = await removeReview(review.id)
    setModalSubmitting(false)
    if (ok) {
      setDeletingReview(null)
    }
  }

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginTop: '20px',
          marginBottom: '20px',
        }}
      >
        <span className="dash-card__eyebrow">
          Daftar Ulasan Anda ({myReviews.length} Ulasan)
        </span>
        <Link
          href="/customer/services"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            height: '38px',
            padding: '0 16px',
            borderRadius: '10px',
            background: 'var(--auth-primary, #245b45)',
            color: '#ffffff',
            fontSize: '12.5px',
            fontWeight: 700,
            textDecoration: 'none',
            transition: 'background 150ms ease',
          }}
        >
          🔍 Cari Layanan Baru
        </Link>
      </div>

      {loading ? (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: '1rem', color: '#64748b' }}>Memuat ulasan Anda...</div>
        </div>
      ) : error ? (
        <div
          style={{
            padding: '24px',
            backgroundColor: '#fef2f2',
            border: '1px solid #f87171',
            borderRadius: '10px',
            color: '#b91c1c',
          }}
        >
          <p style={{ margin: '0 0 10px 0', fontWeight: 600 }}>Gagal Memuat Ulasan</p>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{error}</p>
          <button
            type="button"
            onClick={() => void refreshMine()}
            style={{
              marginTop: '12px',
              padding: '6px 14px',
              backgroundColor: '#b91c1c',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Coba Lagi
          </button>
        </div>
      ) : myReviews.length === 0 ? (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⭐</div>
          <h2 style={{ fontSize: '1.25rem', color: '#0f172a', margin: '0 0 8px 0' }}>
            Belum Ada Ulasan yang Diberikan
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 20px auto' }}>
            Setelah Anda memesan jasa dan pesanan diterima oleh penyedia, Anda dapat memberikan penilaian bintang dan ulasan pengalaman di sini.
          </p>
          <Link
            href="/customer/services"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '42px',
              padding: '0 24px',
              backgroundColor: 'var(--auth-primary, #245b45)',
              color: '#ffffff',
              borderRadius: '10px',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '13px',
              transition: 'background 150ms ease',
            }}
          >
            Mulai Pesan Layanan Jasa
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {myReviews.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              isOwner={true}
              onEdit={(it) => setEditingReview(it)}
              onDelete={(it) => setDeletingReview(it)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <EditReviewModal
        open={Boolean(editingReview)}
        review={editingReview}
        submitting={modalSubmitting}
        onClose={() => setEditingReview(null)}
        onSubmit={async (id, payload) => {
          setModalSubmitting(true)
          const ok = await editReview(id, payload)
          setModalSubmitting(false)
          return ok
        }}
      />

      <DeleteReviewDialog
        open={Boolean(deletingReview)}
        review={deletingReview}
        submitting={modalSubmitting}
        onCancel={() => setDeletingReview(null)}
        onConfirm={(rev) => void handleConfirmDelete(rev)}
      />
    </div>
  )
}
