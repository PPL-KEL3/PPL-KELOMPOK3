'use client'

import { useEffect, useId } from 'react'
import { AlertIcon } from '@/components/ui/AuthIcons'
import { CloseIcon, TrashIcon } from '@/components/provider/services/ServiceIcons'
import type { ServiceArea } from '@/types/provider'
import { MapPinIcon } from './ProfileIcons'

interface DeleteServiceAreaDialogProps {
  open: boolean
  serviceArea: ServiceArea | null
  submitting?: boolean
  errorMessage?: string | null
  onCancel: () => void
  onConfirm: (serviceArea: ServiceArea) => void
}

export function DeleteServiceAreaDialog({
  open,
  serviceArea,
  submitting = false,
  errorMessage = null,
  onCancel,
  onConfirm,
}: DeleteServiceAreaDialogProps) {
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

  if (!open || !serviceArea) return null

  return (
    <div
      className="prf-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onCancel()
        }
      }}
    >
      <div
        className="prf-modal prf-modal--confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="prf-modal__header">
          <div className="prf-modal__title-group">
            <span
              className="prf-modal__badge-icon prf-modal__badge-icon--danger"
              aria-hidden="true"
            >
              <AlertIcon size={21} />
            </span>
            <div>
              <span className="dash-card__eyebrow prf-eyebrow--danger">
                Konfirmasi Penghapusan
              </span>
              <h2 id={titleId} className="prf-modal__title">
                Hapus Wilayah Layanan?
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="prf-modal__close"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Tutup dialog konfirmasi hapus wilayah"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div id={descId} className="prf-delete-body">
          <p className="prf-delete-lead">
            Wilayah layanan berikut akan dihapus dari profil publik kamu:
          </p>

          <div className="prf-delete-target">
            <strong>
              <MapPinIcon size={16} />
              {serviceArea.areaName}
            </strong>
            <span>Radius {serviceArea.radiusKm} km</span>
          </div>

          <p className="prf-delete-warning">
            Kamu tetap dapat menambahkan wilayah ini kembali kapan saja.
          </p>

          {errorMessage && (
            <div className="prf-form-alert" role="alert">
              <AlertIcon size={16} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="prf-modal__actions">
          <button
            type="button"
            className="prf-btn prf-btn--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="button"
            className="prf-btn prf-btn--danger"
            onClick={() => onConfirm(serviceArea)}
            disabled={submitting}
          >
            <TrashIcon size={16} />
            <span>{submitting ? 'Menghapus...' : 'Hapus Wilayah'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
