'use client'

import { useEffect, useId } from 'react'
import { AlertIcon, CloseIcon } from '@/components/ui/AuthIcons'
import { TrashIcon } from '@/components/provider/services/ServiceIcons'
import { formatRupiah } from '@/lib/package-utils'
import type { PackageItem } from '@/types/package'

interface DeletePackageDialogProps {
  open: boolean
  item: PackageItem | null
  serviceName: string
  submitting?: boolean
  errorMessage?: string | null
  onCancel: () => void
  onConfirm: (item: PackageItem) => void
}

export function DeletePackageDialog({
  open,
  item,
  serviceName,
  submitting = false,
  errorMessage = null,
  onCancel,
  onConfirm,
}: DeletePackageDialogProps) {
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

  if (!open || !item) return null

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
                Hapus Paket?
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="pkg-modal__close"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Tutup dialog hapus paket"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div id={descId} className="pkg-delete-body">
          <p>Kamu akan menghapus paket berikut dari jasa ini:</p>

          <div className="pkg-delete-target">
            <strong>{item.name}</strong>
            <span>
              {serviceName} &bull; {formatRupiah(item.price)}
            </span>
          </div>

          <p className="pkg-delete-note">
            Paket hilang dari daftar dan tidak tampil ke pelanggan. Booking yang
            sudah memakai paket ini tetap tercatat. Kalau hanya ingin
            menyembunyikan sementara, pakai <strong>Nonaktifkan</strong>.
          </p>

          {errorMessage && (
            <div className="pkg-alert" role="alert">
              <AlertIcon size={16} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="pkg-modal__actions">
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
            <span>{submitting ? 'Menghapus...' : 'Hapus Paket'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
