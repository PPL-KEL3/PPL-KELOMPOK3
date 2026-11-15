'use client'

import { useState } from 'react'

interface RatingStarsProps {
  value: number
  onChange?: (rating: number) => void
  readOnly?: boolean
  size?: number
}

export function RatingStars({
  value,
  onChange,
  readOnly = false,
  size = 20,
}: RatingStarsProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)

  const activeRating = hoverValue !== null ? hoverValue : value

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        cursor: readOnly ? 'default' : 'pointer',
      }}
      role={readOnly ? 'img' : 'radiogroup'}
      aria-label={`Rating ${value} dari 5 bintang`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= activeRating
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange?.(star)}
            onMouseEnter={() => !readOnly && setHoverValue(star)}
            onMouseLeave={() => !readOnly && setHoverValue(null)}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px',
              cursor: readOnly ? 'default' : 'pointer',
              color: isFilled ? '#eab308' : '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.1s ease, color 0.1s ease',
            }}
            aria-label={`${star} Bintang`}
          >
            <svg
              width={size}
              height={size}
              viewBox="0 0 24 24"
              fill={isFilled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={isFilled ? '0' : '2'}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
