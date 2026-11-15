'use client'

import { useEffect, useId } from 'react'
import { CloseIcon } from '@/components/ui/AuthIcons'
import { TrashIcon } from '@/components/provider/services/ServiceIcons'
import type { ReviewItem } from '@/types/review'

interface DeleteReviewDialogProps {
  open: boolean
  review: ReviewItem | null
  submitting?: boolean
  onCancel: () => void
  onConfirm: (review: ReviewItem) => void
}

export function DeleteReviewDialog({
  open,
  review,
  submitting = false,
  onCancel,
  onConfirm,
}: DeleteReviewDialogProps) {
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, submitting, onCancel])

  if (!open || !review) return null

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel()
      }}
    >
      <div className="modal-card" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center' }}>
              <TrashIcon size={18} />
            </span>
            <h2 id={titleId} style={{ margin: 0, fontSize: '1.15rem' }}>
              Tarik Ulasan
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Tutup konfirmasi tarik ulasan"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p id={descId} style={{ fontSize: '0.925rem', color: '#475569', lineHeight: 1.5 }}>
            Apakah Anda yakin ingin menarik ulasan ini?
          </p>
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              marginTop: '10px',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ fontWeight: 600, color: '#0f172a' }}>
              {review.serviceName} ({review.rating} Bintang)
            </div>
            <div style={{ color: '#64748b', fontStyle: 'italic', marginTop: '4px' }}>
              "{review.comment}"
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '10px' }}>
            Setelah ditarik, ulasan dan penilaian ini tidak akan lagi tampil pada profil penyedia jasa.
          </p>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn--danger"
            style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none' }}
            onClick={() => onConfirm(review)}
            disabled={submitting}
          >
            {submitting ? 'Menarik…' : 'Ya, Tarik Ulasan'}
          </button>
        </div>
      </div>
    </div>
  )
}
