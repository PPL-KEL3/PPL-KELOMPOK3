'use client'

import { useEffect, useId } from 'react'
import { AlertIcon, CloseIcon } from '@/components/ui/AuthIcons'
import { TrashIcon } from '@/components/provider/services/ServiceIcons'
import { formatPortfolioDate } from '@/lib/portfolio-utils'
import type { PortfolioItem } from '@/types/portfolio'

interface DeletePortfolioDialogProps {
  item: PortfolioItem | null
  submitting?: boolean
  errorMessage?: string | null
  onCancel: () => void
  onConfirm: (item: PortfolioItem) => void
}

export function DeletePortfolioDialog({
  item,
  submitting = false,
  errorMessage = null,
  onCancel,
  onConfirm,
}: DeletePortfolioDialogProps) {
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!item) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault()
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [item, onCancel, submitting])

  if (!item) return null

  const addedOn = formatPortfolioDate(item.createdAt)

  return (
    <div
      className="pkg-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) onCancel()
      }}
    >
      <div
        className="pkg-modal pkg-modal--confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="pkg-modal__header">
          <div className="pkg-modal__title-group">
            <span className="pkg-modal__icon pkg-modal__icon--danger" aria-hidden="true">
              <TrashIcon size={20} />
            </span>
            <div>
              <span className="dash-card__eyebrow pkg-eyebrow--danger">
                Konfirmasi Penghapusan
              </span>
              <h2 id={titleId} className="pkg-modal__title">
                Hapus Portofolio?
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="pkg-modal__close"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Tutup dialog hapus portofolio"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div id={descId} className="pkg-delete-body">
          <div className="pf-delete-target">
            <img src={item.imageUrl} alt="" />
            <div>
              <strong>{item.title}</strong>
              {addedOn && <span>Ditambahkan {addedOn}</span>}
            </div>
          </div>

          <p className="pkg-delete-note">
            Foto dan datanya dihapus permanen dari LOKA dan tidak bisa
            dikembalikan. Portofolio bukan data transaksi, jadi tidak ada versi
            nonaktif.
          </p>

          {errorMessage && (
            <div className="pkg-alert" role="alert">
              <AlertIcon size={16} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="pkg-modal__actions pkg-modal__actions--plain">
          <button
            type="button"
            className="pkg-btn pkg-btn--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="button"
            className="pkg-btn pkg-btn--danger"
            onClick={() => onConfirm(item)}
            disabled={submitting}
          >
            <TrashIcon size={16} />
            <span>{submitting ? 'Menghapus...' : 'Hapus Portofolio'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
