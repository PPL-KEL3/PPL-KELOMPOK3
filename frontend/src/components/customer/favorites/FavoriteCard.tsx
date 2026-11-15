'use client'

import Link from 'next/link'
import { formatRupiah } from '@/data/mock-services'
import { EditIcon, TrashIcon } from '@/components/provider/services/ServiceIcons'
import type { FavoriteItem } from '@/types/favorite'

interface FavoriteCardProps {
  item: FavoriteItem
  onEdit: (item: FavoriteItem) => void
  onDelete: (item: FavoriteItem) => void
}

export function FavoriteCard({ item, onEdit, onDelete }: FavoriteCardProps) {
  const isService = item.itemType === 'service'
  const target = item.target

  const waLink = target.whatsappNumber
    ? `https://wa.me/${target.whatsappNumber}?text=${encodeURIComponent(
        `Halo ${target.title}, saya menemukan profil Anda di LOKA Favorit dan tertarik dengan layanan Anda.`
      )}`
    : null

  return (
    <article
      className="dash-card favorite-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px',
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div>
        {/* Header badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: isService ? 'var(--auth-success-soft, #eaf3ec)' : '#f5f8f5',
                color: isService ? 'var(--auth-primary, #245b45)' : 'var(--auth-dark, #183f32)',
                border: `1px solid ${isService ? '#cfdbd1' : '#d4dfd6'}`,
              }}
            >
              {isService ? 'Layanan Jasa' : 'Penyedia Jasa'}
            </span>
            {target.categoryName && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                }}
              >
                {target.categoryName}
              </span>
            )}
            {item.label && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #fde68a',
                }}
              >
                🏷️ {item.label}
              </span>
            )}
          </div>

          {/* Action icons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => onEdit(item)}
              title="Edit label & catatan pribadi"
              style={{
                background: 'transparent',
                border: 'none',
                padding: '6px',
                cursor: 'pointer',
                borderRadius: '4px',
                color: '#64748b',
              }}
            >
              <EditIcon size={16} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              title="Hapus dari favorit"
              style={{
                background: 'transparent',
                border: 'none',
                padding: '6px',
                cursor: 'pointer',
                borderRadius: '4px',
                color: '#ef4444',
              }}
            >
              <TrashIcon size={16} />
            </button>
          </div>
        </div>

        {/* Title & Provider */}
        <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: '#0f172a' }}>
          {target.title}
        </h3>
        {target.providerName && (
          <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#64748b' }}>
            Oleh <strong>{target.providerName}</strong>
          </p>
        )}
        {target.serviceArea && (
          <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#64748b' }}>
            📍 Area: <strong>{target.serviceArea}</strong>
          </p>
        )}

        {/* Description */}
        {target.description && (
          <p
            style={{
              fontSize: '0.875rem',
              color: '#334155',
              lineHeight: 1.5,
              margin: '0 0 12px 0',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {target.description}
          </p>
        )}

        {/* Personal Notes Banner */}
        {item.notes && (
          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '1px dashed #fde68a',
              borderRadius: '8px',
              padding: '8px 12px',
              margin: '10px 0 14px 0',
              fontSize: '0.825rem',
              color: '#78350f',
            }}
          >
            <strong>📝 Catatan Pribadi:</strong> {item.notes}
          </div>
        )}
      </div>

      {/* Footer & Actions */}
      <div
        style={{
          borderTop: '1px solid #f1f5f9',
          paddingTop: '14px',
          marginTop: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        {target.price !== undefined && target.price !== null ? (
          <div>
            <div style={{ fontSize: '11px', color: 'var(--auth-muted, #78847c)', fontWeight: 600 }}>Mulai dari</div>
            <strong style={{ fontSize: '1.15rem', color: 'var(--auth-primary, #245b45)', fontWeight: 800 }}>
              {formatRupiah(target.price)}
            </strong>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--auth-primary, #245b45)', fontWeight: 700 }}>
            Penyedia Terverifikasi
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isService && item.serviceId ? (
            <Link
              href={`/customer/booking/new?serviceId=${encodeURIComponent(item.serviceId)}`}
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '6px 14px',
                backgroundColor: 'var(--auth-primary, #245b45)',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                transition: 'background 150ms ease',
              }}
            >
              Booking
            </Link>
          ) : null}

          {item.providerId && (
            <Link
              href={`/providers/${encodeURIComponent(item.providerId)}`}
              className="catalog-profile-link"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '0 12px',
                minHeight: '32px',
                borderRadius: '8px',
                textDecoration: 'none',
                border: '1px solid #cfdbd1',
                color: 'var(--auth-primary, #245b45)',
                backgroundColor: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Lihat Profil
            </Link>
          )}

          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{
                fontSize: '0.8rem',
                padding: '6px 12px',
                backgroundColor: '#25D366',
                color: '#ffffff',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              WhatsApp
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
