'use client'

import { useEffect, useId, useState, type FormEvent } from 'react'
import { CloseIcon } from '@/components/ui/AuthIcons'
import { RatingStars } from './RatingStars'
import type { ReviewItem, UpdateReviewPayload } from '@/types/review'

interface EditReviewModalProps {
  open: boolean
  review: ReviewItem | null
  submitting?: boolean
  onClose: () => void
  onSubmit: (id: string, payload: UpdateReviewPayload) => Promise<boolean>
}

export function EditReviewModal({
  open,
  review,
  submitting = false,
  onClose,
  onSubmit,
}: EditReviewModalProps) {
  const titleId = useId()
  const [rating, setRating] = useState<number>(5)
  const [comment, setComment] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (review) {
      setRating(review.rating)
      setComment(review.comment)
      setError(null)
    }
  }, [review, open])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, submitting, onClose])

  if (!open || !review) return null

  const remainingEdits = Math.max(0, 3 - review.editCount)
  const isLimitReached = remainingEdits <= 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!review) return
    setError(null)

    if (isLimitReached) {
      setError('Batas maksimal pengubahan ulasan (3x) telah tercapai.')
      return
    }

    if (rating < 1 || rating > 5) {
      setError('Silakan pilih rating antara 1 sampai 5 bintang.')
      return
    }

    const trimmed = comment.trim()
    if (trimmed.length < 10) {
      setError('Komentar ulasan minimal 10 karakter.')
      return
    }
    if (trimmed.length > 1000) {
      setError('Komentar ulasan maksimal 1000 karakter.')
      return
    }

    const ok = await onSubmit(review.id, {
      rating,
      comment: trimmed,
    })

    if (ok) {
      onClose()
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div className="modal-card" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div>
            <h2 id={titleId} style={{ margin: 0, fontSize: '1.2rem' }}>
              Ubah Ulasan & Rating
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
              {review.serviceName}
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup form ubah ulasan"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Limit notification badge */}
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: isLimitReached ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${isLimitReached ? '#f87171' : '#bbf7d0'}`,
                color: isLimitReached ? '#b91c1c' : '#166534',
                fontSize: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>Riwayat perubahan: <strong>{review.editCount} dari 3 kali</strong></span>
              <span style={{ fontWeight: 600 }}>
                {isLimitReached ? 'Kuota Habis' : `Sisa ${remainingEdits}x kesempatan`}
              </span>
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #f87171',
                  borderRadius: '6px',
                  color: '#b91c1c',
                  fontSize: '0.85rem',
                }}
              >
                {error}
              </div>
            )}

            {/* Star selector */}
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                Perbarui Nilai Rating
              </div>
              <RatingStars value={rating} onChange={setRating} size={30} readOnly={isLimitReached} />
            </div>

            {/* Comment textarea */}
            <div>
              <label
                htmlFor="edit-review-comment"
                style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.875rem' }}
              >
                Komentar Ulasan
              </label>
              <textarea
                id="edit-review-comment"
                rows={4}
                className="input"
                placeholder="Perbarui komentar ulasan Anda..."
                value={comment}
                maxLength={1000}
                onChange={(e) => setComment(e.target.value)}
                disabled={submitting || isLimitReached}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                <span>Minimal 10 karakter</span>
                <span>{comment.length}/1000 karakter</span>
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || isLimitReached}
              style={{ backgroundColor: 'var(--auth-primary, #245b45)', color: '#fff', border: 'none' }}
            >
              {submitting ? 'Menyimpan…' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
