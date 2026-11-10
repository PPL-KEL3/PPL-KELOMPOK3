'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { AlertIcon, InfoIcon } from '@/components/ui/AuthIcons'
import type { CategoryDataSource, CategoryMutationResult } from '@/hooks/useCategories'
import type {
  Category,
  CategoryFormErrors,
  CategoryFormInput,
} from '@/types/category'
import { CategoryTagIcon, CloseIcon } from './CategoryIcons'

export type CategoryModalMode = 'create' | 'edit'

interface CategoryFormModalProps {
  open: boolean
  mode: CategoryModalMode
  dataSource?: CategoryDataSource
  submitting?: boolean
  initialCategory?: Category | null
  onClose: () => void
  onSubmit: (
    input: CategoryFormInput
  ) => Promise<CategoryMutationResult> | CategoryMutationResult
}

export function CategoryFormModal({
  open,
  mode,
  dataSource = 'local',
  submitting = false,
  initialCategory = null,
  onClose,
  onSubmit,
}: CategoryFormModalProps) {
  const titleId = useId()
  const descId = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<CategoryFormErrors>({})

  useEffect(() => {
    if (!open) return

    if (mode === 'edit' && initialCategory) {
      setName(initialCategory.name)
      setDescription(initialCategory.description ?? '')
    } else {
      setName('')
      setDescription('')
    }

    setErrors({})

    const focusTimer = window.setTimeout(() => {
      nameInputRef.current?.focus()
    }, 30)

    return () => window.clearTimeout(focusTimer)
  }, [open, mode, initialCategory])

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
    ? 'Edit Kategori Jasa'
    : 'Tambah Kategori Jasa'
  const modalDescription = isEditMode
    ? `Perbarui informasi untuk kategori "${initialCategory?.name ?? ''}".`
    : 'Tambahkan kategori baru untuk mengelompokkan layanan penyedia jasa di platform LOKA.'
  const submitLabel = submitting
    ? 'Menyimpan...'
    : isEditMode
      ? 'Simpan Perubahan'
      : 'Simpan'

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const result = await onSubmit({ name, description })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }

    onClose()
  }

  return (
    <div
      className="cat-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose()
        }
      }}
    >
      <div
        className="cat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="cat-modal__header">
          <div className="cat-modal__title-group">
            <span className="cat-modal__badge-icon" aria-hidden="true">
              <CategoryTagIcon size={20} />
            </span>
            <div>
              <span className="dash-card__eyebrow">
                {isEditMode ? 'Pembaruan Kategori' : 'Kategori Baru'}
              </span>
              <h2 id={titleId} className="cat-modal__title">
                {modalTitle}
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="cat-modal__close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup dialog form kategori"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <p id={descId} className="cat-modal__subtitle">
          {modalDescription}
        </p>

        <form className="cat-form" onSubmit={handleFormSubmit} noValidate>
          {errors.general && (
            <div className="cat-form-alert" role="alert">
              <AlertIcon size={16} />
              <span>{errors.general}</span>
            </div>
          )}

          <div
            className={`auth-field ${errors.name ? 'auth-field--error' : ''}`}
          >
            <div className="cat-field-head">
              <label htmlFor="category-name-input">
                Nama Kategori{' '}
                <span className="cat-required-mark" aria-hidden="true">
                  *
                </span>
              </label>
              <span className="cat-required-badge">Wajib diisi</span>
            </div>

            <input
              ref={nameInputRef}
              id="category-name-input"
              name="name"
              type="text"
              className="cat-input"
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
              placeholder="Contoh: Perbaikan & Pertukangan Rumah"
              maxLength={80}
              required
              aria-required="true"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={
                errors.name ? 'category-name-error' : 'category-name-hint'
              }
            />

            {errors.name ? (
              <p className="auth-field__error" id="category-name-error">
                <AlertIcon size={14} />
                <span>{errors.name}</span>
              </p>
            ) : (
              <p className="auth-field__hint" id="category-name-hint">
                Gunakan nama kategori 2 sampai 80 karakter yang belum terdaftar.
              </p>
            )}
          </div>

          <div
            className={`auth-field ${
              errors.description ? 'auth-field--error' : ''
            }`}
          >
            <div className="cat-field-head">
              <label htmlFor="category-description-input">
                Deskripsi Kategori
              </label>
              <span className="cat-char-count">
                {description.length}/350
              </span>
            </div>

            <textarea
              id="category-description-input"
              name="description"
              className="cat-textarea"
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
              placeholder="Jelaskan cakupan jenis layanan pada kategori ini, misalnya: Layanan servis AC, perbaikan kulkas, mesin cuci, dan instalasi listrik rumah."
              maxLength={350}
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={
                errors.description
                  ? 'category-description-error'
                  : 'category-description-hint'
              }
            />

            {errors.description ? (
              <p className="auth-field__error" id="category-description-error">
                <AlertIcon size={14} />
                <span>{errors.description}</span>
              </p>
            ) : (
              <p className="auth-field__hint" id="category-description-hint">
                Deskripsi membantu penyedia jasa dan pelanggan memahami cakupan
                layanan dalam kategori ini.
              </p>
            )}
          </div>

          {dataSource === 'local' && (
            <div className="cat-demo-inline-note">
              <InfoIcon size={16} />
              <span>
                Mode cadangan lokal aktif karena tabel kategori pada server
                belum terhubung.
              </span>
            </div>
          )}

          <div className="cat-modal__actions">
            <button
              type="button"
              className="cat-btn cat-btn--secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="cat-btn cat-btn--primary"
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
