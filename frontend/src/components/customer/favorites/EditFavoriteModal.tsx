'use client'

import { useEffect, useId, useState, type FormEvent } from 'react'
import { CloseIcon } from '@/components/ui/AuthIcons'
import type { FavoriteItem, UpdateFavoritePayload } from '@/types/favorite'

interface EditFavoriteModalProps {
  open: boolean
  item: FavoriteItem | null
  submitting?: boolean
  onClose: () => void
  onSubmit: (id: string, payload: UpdateFavoritePayload) => Promise<boolean>
}

export function EditFavoriteModal({
  open,
  item,
  submitting = false,
  onClose,
  onSubmit,
}: EditFavoriteModalProps) {
  const titleId = useId()
  const [label, setLabel] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (item) {
      setLabel(item.label || '')
      setNotes(item.notes || '')
      setError(null)
    }
  }, [item, open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, submitting, onClose])

  if (!open || !item) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!item) return
    setError(null)

    const trimmedLabel = label.trim()
    const trimmedNotes = notes.trim()

    if (trimmedLabel.length > 50) {
      setError('Label maksimal 50 karakter.')
      return
    }

    if (trimmedNotes.length > 500) {
      setError('Catatan maksimal 500 karakter.')
      return
    }

    const ok = await onSubmit(item.id, {
      label: trimmedLabel || null,
      notes: trimmedNotes || null,
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
          <h2 id={titleId} style={{ margin: 0, fontSize: '1.2rem' }}>
            Edit Catatan Pribadi
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup form edit catatan"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
              Target: <strong>{item.target.title}</strong> ({item.itemType === 'service' ? 'Jasa' : 'Penyedia'})
            </div>

            {error && (
              <div
                style={{
                  padding: '8px 12px',
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

            <div>
              <label
                htmlFor="fav-label-input"
                style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.875rem' }}
              >
                Label / Kategori Pribadi (Opsional)
              </label>
              <input
                id="fav-label-input"
                type="text"
                className="input"
                placeholder="Contoh: AC Rumah Utama, Langganan Bulanan"
                value={label}
                maxLength={50}
                onChange={(e) => setLabel(e.target.value)}
                disabled={submitting}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right', marginTop: '4px' }}>
                {label.length}/50 karakter
              </div>
            </div>

            <div>
              <label
                htmlFor="fav-notes-input"
                style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.875rem' }}
              >
                Catatan Pribadi (Opsional)
              </label>
              <textarea
                id="fav-notes-input"
                rows={4}
                className="input"
                placeholder="Tuliskan catatan khusus untuk layanan atau penyedia ini (hanya Anda yang dapat melihat catatan ini)..."
                value={notes}
                maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }}
              />
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right', marginTop: '4px' }}>
                {notes.length}/500 karakter
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
              disabled={submitting}
            >
              {submitting ? 'Menyimpan…' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
