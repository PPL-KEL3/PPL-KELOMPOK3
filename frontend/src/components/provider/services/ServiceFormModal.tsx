'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { AlertIcon } from '@/components/ui/AuthIcons'
import type { ServiceMutationResult } from '@/hooks/useServices'
import type { Category } from '@/types/category'
import type {
  ServiceFormErrors,
  ServiceFormInput,
  ServiceItem,
} from '@/types/service'
import { BriefcaseIcon, CloseIcon } from './ServiceIcons'

export type ServiceModalMode = 'create' | 'edit'

interface ServiceFormModalProps {
  open: boolean
  mode: ServiceModalMode
  categories: Category[]
  submitting?: boolean
  initialService?: ServiceItem | null
  onClose: () => void
  onSubmit: (
    input: ServiceFormInput
  ) => Promise<ServiceMutationResult> | ServiceMutationResult
}

export function ServiceFormModal({
  open,
  mode,
  categories,
  submitting = false,
  initialService = null,
  onClose,
  onSubmit,
}: ServiceFormModalProps) {
  const titleId = useId()
  const descId = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<ServiceFormErrors>({})

  useEffect(() => {
    if (!open) return

    if (mode === 'edit' && initialService) {
      setName(initialService.name)
      setCategoryId(initialService.categoryId)
      setDescription(initialService.description)
      setPrice(String(initialService.price))
      setIsActive(initialService.isActive)
    } else {
      setName('')
      setCategoryId(categories[0]?.id ?? '')
      setDescription('')
      setPrice('')
      setIsActive(true)
    }

    setErrors({})

    const focusTimer = window.setTimeout(() => {
      nameInputRef.current?.focus()
    }, 30)

    return () => window.clearTimeout(focusTimer)
  }, [open, mode, initialService, categories])

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

  const isEditMode = mode === 'edit'
  const modalTitle = isEditMode
    ? 'Edit Layanan Jasa'
    : 'Tambah Layanan Jasa Baru'
  const modalDescription = isEditMode
    ? `Perbarui rincian informasi dan harga untuk layanan "${initialService?.name ?? ''}".`
    : 'Lengkapi nama layanan, kategori, deskripsi pekerjaan, dan harga dasar agar pelanggan dapat menemukan jasa kamu.'
  const submitLabel = submitting
    ? 'Menyimpan...'
    : isEditMode
      ? 'Simpan Perubahan'
      : 'Simpan Layanan'

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const result = await onSubmit({
      name,
      categoryId,
      description,
      price,
      isActive,
    })

    if (!result.ok) {
      setErrors(result.errors)
      return
    }

    onClose()
  }

  return (
    <div
      className="svc-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose()
        }
      }}
    >
      <div
        className="svc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="svc-modal__header">
          <div className="svc-modal__title-group">
            <span className="svc-modal__badge-icon" aria-hidden="true">
              <BriefcaseIcon size={20} />
            </span>
            <div>
              <span className="dash-card__eyebrow">
                {isEditMode ? 'Pembaruan Layanan' : 'Layanan Baru'}
              </span>
              <h2 id={titleId} className="svc-modal__title">
                {modalTitle}
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="svc-modal__close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup dialog form layanan"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <p id={descId} className="svc-modal__subtitle">
          {modalDescription}
        </p>

        <form className="svc-form" onSubmit={handleFormSubmit} noValidate>
          {errors.general && (
            <div className="svc-form-alert" role="alert">
              <AlertIcon size={16} />
              <span>{errors.general}</span>
            </div>
          )}

          <div
            className={`auth-field ${errors.name ? 'auth-field--error' : ''}`}
          >
            <div className="svc-field-head">
              <label htmlFor="service-name-input">
                Nama Layanan Jasa{' '}
                <span className="svc-required-mark" aria-hidden="true">
                  *
                </span>
              </label>
              <span className="svc-required-badge">Wajib diisi</span>
            </div>

            <input
              ref={nameInputRef}
              id="service-name-input"
              name="name"
              type="text"
              className="svc-input"
              value={name}
              disabled={submitting}
              onChange={(event) => {
                setName(event.target.value)
                if (errors.name || errors.general) {
                  setErrors((current) => ({
                    ...current,
                    name: undefined,
                    general: undefined,
                  }))
                }
              }}
              placeholder="Contoh: Cuci AC Split & Pengecekan Freon"
              maxLength={100}
              required
              aria-required="true"
              aria-invalid={errors.name ? true : undefined}
            />

            {errors.name && (
              <p className="auth-field__error">
                <AlertIcon size={14} />
                <span>{errors.name}</span>
              </p>
            )}
          </div>

          <div className="svc-form-row">
            <div
              className={`auth-field ${
                errors.categoryId ? 'auth-field--error' : ''
              }`}
            >
              <div className="svc-field-head">
                <label htmlFor="service-category-select">
                  Kategori Jasa{' '}
                  <span className="svc-required-mark" aria-hidden="true">
                    *
                  </span>
                </label>
                <span className="svc-required-badge">Wajib dipilih</span>
              </div>

              <select
                id="service-category-select"
                name="categoryId"
                className="svc-select"
                value={categoryId}
                disabled={submitting}
                onChange={(event) => {
                  setCategoryId(event.target.value)
                  if (errors.categoryId || errors.general) {
                    setErrors((current) => ({
                      ...current,
                      categoryId: undefined,
                      general: undefined,
                    }))
                  }
                }}
                required
                aria-required="true"
                aria-invalid={errors.categoryId ? true : undefined}
              >
                <option value="">Pilih kategori jasa...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              {errors.categoryId && (
                <p className="auth-field__error">
                  <AlertIcon size={14} />
                  <span>{errors.categoryId}</span>
                </p>
              )}
            </div>

            <div
              className={`auth-field ${errors.price ? 'auth-field--error' : ''}`}
            >
              <div className="svc-field-head">
                <label htmlFor="service-price-input">
                  Harga Dasar (Rp){' '}
                  <span className="svc-required-mark" aria-hidden="true">
                    *
                  </span>
                </label>
                <span className="svc-required-badge">Wajib diisi</span>
              </div>

              <input
                id="service-price-input"
                name="price"
                type="number"
                min={1000}
                step={1000}
                className="svc-input"
                value={price}
                disabled={submitting}
                onChange={(event) => {
                  setPrice(event.target.value)
                  if (errors.price || errors.general) {
                    setErrors((current) => ({
                      ...current,
                      price: undefined,
                      general: undefined,
                    }))
                  }
                }}
                placeholder="Contoh: 85000"
                required
                aria-required="true"
                aria-invalid={errors.price ? true : undefined}
              />

              {errors.price && (
                <p className="auth-field__error">
                  <AlertIcon size={14} />
                  <span>{errors.price}</span>
                </p>
              )}
            </div>
          </div>

          <div
            className={`auth-field ${
              errors.description ? 'auth-field--error' : ''
            }`}
          >
            <div className="svc-field-head">
              <label htmlFor="service-description-input">
                Deskripsi Layanan{' '}
                <span className="svc-required-mark" aria-hidden="true">
                  *
                </span>
              </label>
              <span className="svc-char-count">{description.length}/500</span>
            </div>

            <textarea
              id="service-description-input"
              name="description"
              className="svc-textarea"
              rows={4}
              value={description}
              disabled={submitting}
              onChange={(event) => {
                setDescription(event.target.value)
                if (errors.description || errors.general) {
                  setErrors((current) => ({
                    ...current,
                    description: undefined,
                    general: undefined,
                  }))
                }
              }}
              placeholder="Jelaskan cakupan pekerjaan, estimasi pengerjaan, dan ketentuan layanan minimal 10 karakter."
              maxLength={500}
              required
              aria-required="true"
              aria-invalid={errors.description ? true : undefined}
            />

            {errors.description && (
              <p className="auth-field__error">
                <AlertIcon size={14} />
                <span>{errors.description}</span>
              </p>
            )}
          </div>

          <label className="svc-checkbox-row">
            <input
              type="checkbox"
              checked={isActive}
              disabled={submitting}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <div>
              <strong>Publikasikan layanan ke direktori pelanggan</strong>
              <span>
                Jika tidak dicentang, layanan disimpan sebagai nonaktif dan tidak
                ditampilkan di pencarian pelanggan.
              </span>
            </div>
          </label>

          <div className="svc-modal__actions">
            <button
              type="button"
              className="svc-btn svc-btn--secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="svc-btn svc-btn--primary"
              disabled={submitting}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

