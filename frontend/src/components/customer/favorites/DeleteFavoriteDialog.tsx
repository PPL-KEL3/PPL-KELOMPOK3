'use client'

import { useEffect, useId } from 'react'
import { AlertIcon, CloseIcon } from '@/components/ui/AuthIcons'
import { TrashIcon } from '@/components/provider/services/ServiceIcons'
import type { FavoriteItem } from '@/types/favorite'

interface DeleteFavoriteDialogProps {
  open: boolean
  item: FavoriteItem | null
  submitting?: boolean
  onCancel: () => void
  onConfirm: (item: FavoriteItem) => void
}

export function DeleteFavoriteDialog({
  open,
  item,
  submitting = false,
  onCancel,
  onConfirm,
}: DeleteFavoriteDialogProps) {
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

  if (!open || !item) return null

  const itemTypeName = item.itemType === 'service' ? 'layanan jasa' : 'penyedia jasa'

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
              Hapus dari Favorit
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Tutup dialog konfirmasi"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p id={descId} style={{ fontSize: '0.925rem', color: '#475569', lineHeight: 1.5 }}>
            Apakah Anda yakin ingin menghapus <strong>"{item.target.title}"</strong> dari daftar favorit Anda?
          </p>
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              marginTop: '12px',
              fontSize: '0.85rem',
              color: '#64748b',
            }}
          >
            Tipe item: <strong>{itemTypeName}</strong>
            {item.label && (
              <div>
                Label: <em>"{item.label}"</em>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
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
            onClick={() => onConfirm(item)}
            disabled={submitting}
          >
            {submitting ? 'Menghapus…' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}
