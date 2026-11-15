'use client'

import { RatingStars } from './RatingStars'
import { ReviewCard } from './ReviewCard'
import type { ProviderReviewStats, ReviewItem } from '@/types/review'

interface ReviewsListProps {
  reviews: ReviewItem[]
  stats?: ProviderReviewStats | null
  currentUserId?: string
  onEdit?: (review: ReviewItem) => void
  onDelete?: (review: ReviewItem) => void
}

export function ReviewsList({
  reviews,
  stats,
  currentUserId,
  onEdit,
  onDelete,
}: ReviewsListProps) {
  const total = stats?.totalReviews ?? reviews.length
  const avg = stats?.averageRating ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Stats Summary Card */}
      {stats && (
        <div
          style={{
            padding: '20px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            alignItems: 'center',
          }}
        >
          {/* Left score */}
          <div style={{ textAlign: 'center', minWidth: '120px' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              {total > 0 ? avg.toFixed(1) : '0.0'}
            </div>
            <div style={{ margin: '6px 0 4px 0' }}>
              <RatingStars value={Math.round(avg)} readOnly size={18} />
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {total} Ulasan Pelanggan
            </div>
          </div>

          {/* Right distribution bars */}
          <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.ratingDistribution[star as 1 | 2 | 3 | 4 | 5] || 0
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                  <span style={{ width: '45px', color: '#64748b' }}>{star} ★</span>
                  <div
                    style={{
                      flex: 1,
                      height: '8px',
                      backgroundColor: '#e2e8f0',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: '#eab308',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                  <span style={{ width: '35px', textAlign: 'right', color: '#94a3b8' }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Review items */}
      {reviews.length === 0 ? (
        <div
          style={{
            padding: '30px 20px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            color: '#64748b',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💬</div>
          <p style={{ margin: 0, fontWeight: 500 }}>Belum ada ulasan untuk penyedia ini.</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
            Jadilah pelanggan pertama yang memberikan rating dan ulasan setelah memesan layanan!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reviews.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              isOwner={currentUserId === r.customerId}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
