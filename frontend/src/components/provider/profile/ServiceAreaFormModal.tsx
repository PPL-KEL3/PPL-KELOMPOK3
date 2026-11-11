'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { AlertIcon } from '@/components/ui/AuthIcons'
import { CloseIcon } from '@/components/provider/services/ServiceIcons'
import type { ServiceAreaMutationResult } from '@/hooks/useProviderServiceAreas'
import type {
  ServiceArea,
  ServiceAreaFormErrors,
  ServiceAreaFormInput,
} from '@/types/provider'
import { MapPinIcon } from './ProfileIcons'

export type ServiceAreaModalMode = 'create' | 'edit'

interface ServiceAreaFormModalProps {
  open: boolean
  mode: ServiceAreaModalMode
  submitting?: boolean
  initialServiceArea?: ServiceArea | null
  onClose: () => void
  onSubmit: (
    input: ServiceAreaFormInput
  ) => Promise<ServiceAreaMutationResult> | ServiceAreaMutationResult
}

export function ServiceAreaFormModal({
  open,
  mode,
  submitting = false,
  initialServiceArea = null,
  onClose,
  onSubmit,
}: ServiceAreaFormModalProps) {
  const titleId = useId()
  const descId = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [areaName, setAreaName] = useState('')
  const [radiusKm, setRadiusKm] = useState('5')
  const [errors, setErrors] = useState<ServiceAreaFormErrors>({})

  useEffect(() => {
    if (!open) return

    if (mode === 'edit' && initialServiceArea) {
      setAreaName(initialServiceArea.areaName)
      setRadiusKm(String(initialServiceArea.radiusKm))
    } else {
      setAreaName('')
      setRadiusKm('5')
    }

    setErrors({})

    const timer = window.setTimeout(() => {
      nameInputRef.current?.focus()
    }, 30)

    return () => window.clearTimeout(timer)
  }, [open, mode, initialServiceArea])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, submitting])

  if (!open) return null

  const isEdit = mode === 'edit'
  const title = isEdit ? 'Edit Wilayah Layanan' : 'Tambah Wilayah Layanan'
  const description = isEdit
    ? `Perbarui nama wilayah atau radius untuk "${initialServiceArea?.areaName ?? ''}".`
    : 'Tambahkan wilayah tempat kamu bersedia melayani pelanggan beserta radius jangkauannya.'

  function validate(): ServiceAreaFormErrors {
    const nextErrors: ServiceAreaFormErrors = {}
    const trimmedName = areaName.trim().replace(/\s+/g, ' ')
    const parsedRadius = Number(radiusKm.replace(',', '.').trim())

    if (!trimmedName) {
      nextErrors.areaName = 'Nama wilayah layanan wajib diisi.'
    } else if (trimmedName.length < 3) {
      nextErrors.areaName = 'Nama wilayah layanan minimal 3 karakter.'
    } else if (trimmedName.length > 100) {
      nextErrors.areaName = 'Nama wilayah layanan maksimal 100 karakter.'
    }

    if (!radiusKm.trim() || !Number.isFinite(parsedRadius)) {
      nextErrors.radiusKm = 'Radius layanan wajib diisi dengan angka.'
    } else if (parsedRadius < 1 || parsedRadius > 100) {
      nextErrors.radiusKm = 'Radius layanan harus antara 1 dan 100 km.'
    }

    return nextErrors
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const clientErrors = validate()
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    const result = await onSubmit({
      areaName: areaName.trim().replace(/\s+/g, ' '),
      radiusKm,
    })

    if (!result.ok) {
      setErrors(result.errors)
      return
    }

    onClose()
  }

  return (
    <div
      className="prf-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose()
        }
      }}
    >
      <div
        className="prf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="prf-modal__header">
          <div className="prf-modal__title-group">
            <span className="prf-modal__badge-icon" aria-hidden="true">
              <MapPinIcon size={20} />
            </span>
            <div>
              <span className="dash-card__eyebrow">
                {isEdit ? 'Pembaruan Wilayah' : 'Wilayah Baru'}
              </span>
              <h2 id={titleId} className="prf-modal__title">
                {title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="prf-modal__close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup dialog wilayah layanan"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <p id={descId} className="prf-modal__subtitle">
          {description}
        </p>

        <form className="prf-modal__form" onSubmit={handleSubmit} noValidate>
          {errors.general && (
            <p className="auth-field__error">
              <AlertIcon size={14} />
              <span>{errors.general}</span>
            </p>
          )}

          <div
            className={`auth-field ${errors.areaName ? 'auth-field--error' : ''}`}
          >
            <div className="prf-field-head">
              <label htmlFor="service-area-name">
                Nama Wilayah{' '}
                <span className="prf-required-mark" aria-hidden="true">
                  *
                </span>
              </label>
              <span className="prf-required-badge">Wajib diisi</span>
            </div>
            <input
              ref={nameInputRef}
              id="service-area-name"
              className="prf-input"
              type="text"
              value={areaName}
              disabled={submitting}
              onChange={(event) => {
                setAreaName(event.target.value)
                setErrors((current) => ({
                  ...current,
                  areaName: undefined,
                  general: undefined,
                }))
              }}
              placeholder="Contoh: Kecamatan Coblong"
              maxLength={100}
              aria-invalid={errors.areaName ? true : undefined}
            />
            {errors.areaName ? (
              <p className="auth-field__error">
                <AlertIcon size={14} />
                <span>{errors.areaName}</span>
              </p>
            ) : (
              <p className="auth-field__hint">
                Gunakan nama kecamatan, kelurahan, atau area yang mudah dikenali.
              </p>
            )}
          </div>

          <div
            className={`auth-field ${errors.radiusKm ? 'auth-field--error' : ''}`}
          >
            <div className="prf-field-head">
              <label htmlFor="service-area-radius">
                Radius Layanan (km){' '}
                <span className="prf-required-mark" aria-hidden="true">
                  *
                </span>
              </label>
              <span className="prf-required-badge">1–100 km</span>
            </div>
            <input
              id="service-area-radius"
              className="prf-input"
              type="number"
              min={1}
              max={100}
              step={1}
              value={radiusKm}
              disabled={submitting}
              onChange={(event) => {
                setRadiusKm(event.target.value)
                setErrors((current) => ({
                  ...current,
                  radiusKm: undefined,
                  general: undefined,
                }))
              }}
              placeholder="Contoh: 5"
              aria-invalid={errors.radiusKm ? true : undefined}
            />
            {errors.radiusKm ? (
              <p className="auth-field__error">
                <AlertIcon size={14} />
                <span>{errors.radiusKm}</span>
              </p>
            ) : (
              <p className="auth-field__hint">
                Perkiraan jarak jangkauan layanan dari wilayah tersebut.
              </p>
            )}
          </div>

          <div className="prf-modal__actions">
            <button
              type="button"
              className="prf-btn prf-btn--secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="prf-btn prf-btn--primary"
              disabled={submitting}
            >
              {submitting && <span className="auth-spinner" aria-hidden="true" />}
              <span>
                {submitting
                  ? 'Menyimpan...'
                  : isEdit
                    ? 'Simpan Perubahan'
                    : 'Tambah Wilayah'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
