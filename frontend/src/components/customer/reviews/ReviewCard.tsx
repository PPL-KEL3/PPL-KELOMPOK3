'use client'

import { RatingStars } from './RatingStars'
import { EditIcon, TrashIcon } from '@/components/provider/services/ServiceIcons'
import type { ReviewItem } from '@/types/review'

interface ReviewCardProps {
  review: ReviewItem
  isOwner?: boolean
  onEdit?: (review: ReviewItem) => void
  onDelete?: (review: ReviewItem) => void
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function ReviewCard({
  review,
  isOwner = false,
  onEdit,
  onDelete,
}: ReviewCardProps) {
  return (
    <article
      style={{
        padding: '16px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>
              {review.customerName}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>•</span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {formatDate(review.createdAt)}
            </span>
            {review.isEdited && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                }}
                title={`Ulasan telah disunting ${review.editCount} kali`}
              >
                (Diedit)
              </span>
            )}
          </div>
          <div style={{ marginTop: '4px' }}>
            <RatingStars value={review.rating} readOnly size={16} />
          </div>
        </div>

        {isOwner && (
          <div style={{ display: 'flex', gap: '4px' }}>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(review)}
                title="Ubah ulasan"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                <EditIcon size={16} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(review)}
                title="Tarik ulasan"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: '#ef4444',
                }}
              >
                <TrashIcon size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {review.serviceName && (
        <div style={{ fontSize: '12px', color: 'var(--auth-primary, #245b45)', fontWeight: 700 }}>
          Layanan: {review.serviceName}
        </div>
      )}

      <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
        "{review.comment}"
      </p>
    </article>
  )
}
