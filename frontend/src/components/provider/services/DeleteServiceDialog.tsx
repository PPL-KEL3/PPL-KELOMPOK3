'use client'

import { useEffect, useId } from 'react'
import { formatRupiah } from '@/data/mock-services'
import { AlertIcon } from '@/components/ui/AuthIcons'
import type { ServiceItem } from '@/types/service'
import { CloseIcon, TrashIcon } from './ServiceIcons'

interface DeleteServiceDialogProps {
  open: boolean
  service: ServiceItem | null
  submitting?: boolean
  errorMessage?: string | null
  onCancel: () => void
  onConfirm: (service: ServiceItem) => void
}

export function DeleteServiceDialog({
  open,
  service,
  submitting = false,
  errorMessage = null,
  onCancel,
  onConfirm,
}: DeleteServiceDialogProps) {
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

  if (!open || !service) return null

  return (
    <div
      className="svc-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onCancel()
        }
      }}
    >
      <div
        className="svc-modal svc-modal--confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="svc-modal__header">
          <div className="svc-modal__title-group">
            <span
              className="svc-modal__badge-icon svc-modal__badge-icon--danger"
              aria-hidden="true"
            >
              <AlertIcon size={21} />
            </span>
            <div>
              <span className="dash-card__eyebrow svc-eyebrow--danger">
                Konfirmasi Penghapusan
              </span>
              <h2 id={titleId} className="svc-modal__title">
                Hapus Layanan Jasa?
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="svc-modal__close"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Tutup dialog konfirmasi hapus layanan"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div id={descId} className="svc-delete-body">
          <p className="svc-delete-lead">
            Kamu akan menghapus layanan berikut dari daftar jasa yang ditawarkan:
          </p>

          <div className="svc-delete-target">
            <strong>{service.name}</strong>
            <span>
              {service.categoryName} &bull; {formatRupiah(service.price)}
            </span>
          </div>

          <p className="svc-delete-warning">
            Jika layanan ini hanya sedang tidak tersedia sementara, kamu dapat
            memilih tombol <strong>Nonaktifkan</strong> pada tabel tanpa perlu
            menghapusnya secara permanen.
          </p>

          {errorMessage && (
            <div className="svc-form-alert" role="alert">
              <AlertIcon size={16} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="svc-modal__actions">
          <button
            type="button"
            className="svc-btn svc-btn--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="button"
            className="svc-btn svc-btn--danger"
            onClick={() => onConfirm(service)}
            disabled={submitting}
          >
            <TrashIcon size={16} />
            <span>{submitting ? 'Menghapus...' : 'Hapus Layanan'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

