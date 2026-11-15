'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { AlertIcon, CloseIcon, PackageIcon } from '@/components/ui/AuthIcons'
import type { PackageMutationResult } from '@/hooks/usePackages'
import {
  PACKAGE_DESCRIPTION_MAX,
  PACKAGE_NAME_MAX,
  type PackageFormErrors,
  type PackageFormInput,
  type PackageItem,
} from '@/types/package'

export type PackageModalMode = 'create' | 'edit'

interface PackageFormModalProps {
  open: boolean
  mode: PackageModalMode
  serviceName: string
  initialPackage?: PackageItem | null
  submitting?: boolean
  onClose: () => void
  onSubmit: (
    input: PackageFormInput
  ) => Promise<PackageMutationResult> | PackageMutationResult
}

const EMPTY_FORM: PackageFormInput = {
  name: '',
  description: '',
  price: '',
  isActive: true,
}

function toForm(item: PackageItem | null | undefined): PackageFormInput {
  if (!item) return EMPTY_FORM
  return {
    name: item.name,
    description: item.description ?? '',
    price: String(item.price),
    isActive: item.isActive,
  }
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function PackageFormModal({
  open,
  mode,
  serviceName,
  initialPackage = null,
  submitting = false,
  onClose,
  onSubmit,
}: PackageFormModalProps) {
  const titleId = useId()
  const descId = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<PackageFormInput>(EMPTY_FORM)
  const [errors, setErrors] = useState<PackageFormErrors>({})
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const isEdit = mode === 'edit'
  const baseline = isEdit ? toForm(initialPackage) : EMPTY_FORM
  const dirty =
    isEdit &&
    (form.name !== baseline.name ||
      form.description !== baseline.description ||
      form.price !== baseline.price ||
      form.isActive !== baseline.isActive)

  useEffect(() => {
    if (!open) return
    setForm(mode === 'edit' ? toForm(initialPackage) : EMPTY_FORM)
    setErrors({})
    setConfirmDiscard(false)

    const timer = window.setTimeout(() => nameInputRef.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [open, mode, initialPackage])

  function requestClose() {
    if (submitting) return
    if (dirty) {
      setConfirmDiscard(true)
      return
    }
    onClose()
  }

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || submitting) return
      event.preventDefault()
      if (confirmDiscard) {
        setConfirmDiscard(false)
      } else if (dirty) {
        setConfirmDiscard(true)
      } else {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, submitting, confirmDiscard, dirty, onClose])

  if (!open) return null

  function patch(next: Partial<PackageFormInput>, field?: keyof PackageFormErrors) {
    setForm((current) => ({ ...current, ...next }))
    if (field && (errors[field] || errors.general)) {
      setErrors((current) => ({ ...current, [field]: undefined, general: undefined }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const result = await onSubmit(form)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    onClose()
  }

  const submitLabel = submitting
    ? 'Menyimpan...'
    : isEdit
      ? 'Simpan Perubahan'
      : 'Simpan Paket'

  return (
    <div
      className="pkg-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div
        className="pkg-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="pkg-modal__header">
          <div className="pkg-modal__title-group">
            <span className="pkg-modal__icon" aria-hidden="true">
              <PackageIcon size={20} />
            </span>
            <div>
              <span className="dash-card__eyebrow">
                {isEdit ? 'Ubah Paket' : 'Paket Baru'}
              </span>
              <h2 id={titleId} className="pkg-modal__title">
                {isEdit ? 'Edit Paket' : 'Tambah Paket'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="pkg-modal__close"
            onClick={requestClose}
            disabled={submitting}
            aria-label="Tutup dialog form paket"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <p id={descId} className="pkg-modal__subtitle">
          {isEdit
            ? `Ubah informasi paket "${initialPackage?.name ?? ''}". Booking yang sudah dibuat tetap memakai harga lama.`
            : `Paket akan ditambahkan ke jasa: ${serviceName}.`}
        </p>

        <form className="pkg-form" onSubmit={handleSubmit} noValidate>
          {errors.general && (
            <div className="pkg-alert" role="alert">
              <AlertIcon size={16} />
              <span>{errors.general}</span>
            </div>
          )}

          <div className={`pkg-field${errors.name ? ' pkg-field--error' : ''}`}>
            <div className="pkg-field__head">
              <label htmlFor="package-name-input">
                Nama Paket <span className="pkg-required">*</span>
              </label>
              <span className="pkg-badge">Wajib</span>
            </div>
            <input
              ref={nameInputRef}
              id="package-name-input"
              type="text"
              className="pkg-input"
              value={form.name}
              disabled={submitting}
              maxLength={PACKAGE_NAME_MAX}
              placeholder="Contoh: Dasar, Lengkap, Premium"
              onChange={(event) => patch({ name: event.target.value }, 'name')}
              aria-required="true"
              aria-invalid={errors.name ? true : undefined}
            />
            {errors.name && (
              <p className="pkg-field__error">
                <AlertIcon size={14} />
                <span>{errors.name}</span>
              </p>
            )}
          </div>

          <div className="pkg-form-row">
            <div className="pkg-field">
              <div className="pkg-field__head">
                <label htmlFor="package-service-input">Jasa</label>
                <span className="pkg-badge">Otomatis</span>
              </div>
              <input
                id="package-service-input"
                type="text"
                className="pkg-input"
                value={serviceName}
                disabled
                readOnly
              />
            </div>

            <div className={`pkg-field${errors.price ? ' pkg-field--error' : ''}`}>
              <div className="pkg-field__head">
                <label htmlFor="package-price-input">
                  Harga Paket (Rp) <span className="pkg-required">*</span>
                </label>
                <span className="pkg-badge">{isEdit ? 'Rupiah' : 'Wajib'}</span>
              </div>
              <div className="pkg-money">
                <span className="pkg-money__prefix" aria-hidden="true">
                  Rp
                </span>
                <input
                  id="package-price-input"
                  type="text"
                  inputMode="numeric"
                  className="pkg-input pkg-input--money"
                  value={groupThousands(form.price)}
                  disabled={submitting}
                  maxLength={11}
                  placeholder="150.000"
                  onChange={(event) =>
                    patch({ price: event.target.value.replace(/\D/g, '') }, 'price')
                  }
                  aria-required="true"
                  aria-invalid={errors.price ? true : undefined}
                />
              </div>
              {errors.price && (
                <p className="pkg-field__error">
                  <AlertIcon size={14} />
                  <span>{errors.price}</span>
                </p>
              )}
            </div>
          </div>

          <div
            className={`pkg-field${errors.description ? ' pkg-field--error' : ''}`}
          >
            <div className="pkg-field__head">
              <label htmlFor="package-description-input">
                Deskripsi Paket (opsional)
              </label>
              <span className="pkg-count">
                {form.description.length}/{PACKAGE_DESCRIPTION_MAX}
              </span>
            </div>
            <textarea
              id="package-description-input"
              className="pkg-textarea"
              rows={4}
              value={form.description}
              disabled={submitting}
              maxLength={PACKAGE_DESCRIPTION_MAX}
              placeholder="Jelaskan apa saja yang termasuk dalam paket ini."
              onChange={(event) =>
                patch({ description: event.target.value }, 'description')
              }
              aria-invalid={errors.description ? true : undefined}
            />
            {errors.description && (
              <p className="pkg-field__error">
                <AlertIcon size={14} />
                <span>{errors.description}</span>
              </p>
            )}
          </div>

          <label className="pkg-checkbox">
            <input
              type="checkbox"
              checked={form.isActive}
              disabled={submitting}
              onChange={(event) => patch({ isActive: event.target.checked })}
            />
            <div>
              <strong>Aktifkan paket</strong>
              <span>
                Jika tidak dicentang, paket disimpan sebagai Nonaktif dan tidak
                tampil ke pelanggan.
              </span>
            </div>
          </label>

          <div className="pkg-modal__actions">
            <button
              type="button"
              className="pkg-btn pkg-btn--secondary"
              onClick={requestClose}
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="pkg-btn pkg-btn--primary"
              disabled={submitting}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>

      {confirmDiscard && (
        <div className="pkg-backdrop pkg-backdrop--nested">
          <div
            className="pkg-modal pkg-modal--discard"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${titleId}-discard`}
          >
            <h2 id={`${titleId}-discard`} className="pkg-discard__title">
              <AlertIcon size={18} />
              <span>Buang perubahan?</span>
            </h2>
            <p>
              Perubahan pada paket &quot;{initialPackage?.name ?? form.name}
              &quot; belum disimpan. Kalau ditutup sekarang, perubahan akan
              hilang.
            </p>
            <div className="pkg-modal__actions pkg-modal__actions--plain">
              <button
                type="button"
                className="pkg-btn pkg-btn--secondary pkg-btn--sm"
                onClick={() => setConfirmDiscard(false)}
              >
                Lanjut mengedit
              </button>
              <button
                type="button"
                className="pkg-btn pkg-btn--danger pkg-btn--sm"
                onClick={() => {
                  setConfirmDiscard(false)
                  onClose()
                }}
              >
                Buang perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
