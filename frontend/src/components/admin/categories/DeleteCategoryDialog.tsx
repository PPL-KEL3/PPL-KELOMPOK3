'use client'

import { useEffect, useId } from 'react'
import { AlertIcon } from '@/components/ui/AuthIcons'
import type { Category } from '@/types/category'
import { CloseIcon, TrashIcon } from './CategoryIcons'

interface DeleteCategoryDialogProps {
  open: boolean
  category: Category | null
  onCancel: () => void
  onConfirm: (category: Category) => void
}

export function DeleteCategoryDialog({
  open,
  category,
  onCancel,
  onConfirm,
}: DeleteCategoryDialogProps) {
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open || !category) return null

  return (
    <div
      className="cat-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onCancel()
        }
      }}
    >
      <div
        className="cat-modal cat-modal--confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="cat-modal__header">
          <div className="cat-modal__title-group">
            <span
              className="cat-modal__badge-icon cat-modal__badge-icon--danger"
              aria-hidden="true"
            >
              <AlertIcon size={21} />
            </span>
            <div>
              <span className="dash-card__eyebrow cat-eyebrow--danger">
                Konfirmasi Penghapusan
              </span>
              <h2 id={titleId} className="cat-modal__title">
                Hapus Kategori Jasa?
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="cat-modal__close"
            onClick={onCancel}
            aria-label="Tutup dialog konfirmasi hapus"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div id={descId} className="cat-delete-body">
          <p className="cat-delete-lead">
            Anda akan menghapus kategori berikut dari daftar kategori jasa LOKA:
          </p>

          <div className="cat-delete-target">
            <strong>{category.name}</strong>
            {category.description?.trim() && (
              <span>{category.description}</span>
            )}
          </div>

          <p className="cat-delete-warning">
            Tindakan penghapusan ini perlu dikonfirmasi terlebih dahulu. Pastikan
            kategori ini memang tidak lagi diperlukan. Pada tahap demonstrasi UI
            saat ini, penghapusan hanya memengaruhi state lokal sementara.
          </p>
        </div>

        <div className="cat-modal__actions">
          <button
            type="button"
            className="cat-btn cat-btn--secondary"
            onClick={onCancel}
          >
            Batal
          </button>
          <button
            type="button"
            className="cat-btn cat-btn--danger"
            onClick={() => onConfirm(category)}
          >
            <TrashIcon size={16} />
            <span>Hapus</span>
          </button>
        </div>
      </div>
    </div>
  )
}

