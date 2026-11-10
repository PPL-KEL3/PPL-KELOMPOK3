'use client'

import { useEffect, useId } from 'react'
import { AlertIcon } from '@/components/ui/AuthIcons'
import type { Category } from '@/types/category'
import { CloseIcon, TrashIcon } from './CategoryIcons'

interface DeleteCategoryDialogProps {
  open: boolean
  category: Category | null
  submitting?: boolean
  errorMessage?: string | null
  onCancel: () => void
  onConfirm: (category: Category) => void
}

export function DeleteCategoryDialog({
  open,
  category,
  submitting = false,
  errorMessage = null,
  onCancel,
  onConfirm,
}: DeleteCategoryDialogProps) {
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault()
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel, submitting])

  if (!open || !category) return null

  const linkedServicesCount = category.usageCount ?? 0
  const isBlockedByRelation = linkedServicesCount > 0

  return (
    <div
      className="cat-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
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
                {isBlockedByRelation
                  ? 'Perlindungan Relasi Jasa'
                  : 'Konfirmasi Penghapusan'}
              </span>
              <h2 id={titleId} className="cat-modal__title">
                {isBlockedByRelation
                  ? 'Kategori Masih Digunakan'
                  : 'Hapus Kategori Jasa?'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="cat-modal__close"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Tutup dialog konfirmasi hapus"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div id={descId} className="cat-delete-body">
          <p className="cat-delete-lead">
            {isBlockedByRelation
              ? 'Kategori berikut tidak dapat dihapus karena masih terhubung dengan layanan jasa aktif:'
              : 'Anda akan menghapus kategori berikut dari daftar kategori jasa LOKA:'}
          </p>

          <div className="cat-delete-target">
            <strong>{category.name}</strong>
            {category.description?.trim() && (
              <span>{category.description}</span>
            )}
          </div>

          {isBlockedByRelation ? (
            <div className="cat-relation-block" role="alert">
              <AlertIcon size={16} />
              <div>
                <strong>
                  Terhubung dengan {linkedServicesCount} layanan jasa
                </strong>
                <p>
                  Pindahkan atau hapus layanan jasa pada kategori ini terlebih
                  dahulu sebelum menghapus kategori.
                </p>
              </div>
            </div>
          ) : (
            <p className="cat-delete-warning">
              Kategori ini belum terhubung ke layanan jasa mana pun dan aman
              untuk dihapus.
            </p>
          )}

          {errorMessage && (
            <div className="cat-form-alert" role="alert">
              <AlertIcon size={16} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="cat-modal__actions">
          <button
            type="button"
            className="cat-btn cat-btn--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            {isBlockedByRelation ? 'Tutup' : 'Batal'}
          </button>
          {!isBlockedByRelation && (
            <button
              type="button"
              className="cat-btn cat-btn--danger"
              onClick={() => onConfirm(category)}
              disabled={submitting}
            >
              <TrashIcon size={16} />
              <span>{submitting ? 'Menghapus...' : 'Hapus'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
