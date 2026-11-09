'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { AlertIcon, InfoIcon } from '@/components/ui/AuthIcons'
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
  initialCategory?: Category | null
  onClose: () => void
  onSubmit: (
    input: CategoryFormInput
  ) => { ok: true; category: Category } | { ok: false; errors: CategoryFormErrors }
}

export function CategoryFormModal({
  open,
  mode,
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
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const isEditMode = mode === 'edit'
  const modalTitle = isEditMode
    ? 'Edit Kategori Jasa'
    : 'Tambah Kategori Jasa'
  const modalDescription = isEditMode
    ? `Perbarui informasi untuk kategori "${initialCategory?.name ?? ''}".`
    : 'Tambahkan kategori baru untuk mengelompokkan layanan penyedia jasa di platform LOKA.'
  const submitLabel = isEditMode ? 'Simpan Perubahan' : 'Simpan'

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = onSubmit({ name, description })
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
        if (event.target === event.currentTarget) {
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
            aria-label="Tutup dialog form kategori"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <p id={descId} className="cat-modal__subtitle">
          {modalDescription}
        </p>

        <form className="cat-form" onSubmit={handleFormSubmit} noValidate>
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
              onChange={(event) => {
                setName(event.target.value)
                if (errors.name) {
                  setErrors((current) => ({ ...current, name: undefined }))
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
                Gunakan nama kategori yang ringkas, jelas, dan belum terdaftar.
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
              onChange={(event) => {
                setDescription(event.target.value)
                if (errors.description) {
                  setErrors((current) => ({
                    ...current,
                    description: undefined,
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

          <div className="cat-demo-inline-note">
            <InfoIcon size={16} />
            <span>
              Mode demonstrasi: perubahan disimpan pada state lokal antarmuka dan
              belum dikirim ke database.
            </span>
          </div>

          <div className="cat-modal__actions">
            <button
              type="button"
              className="cat-btn cat-btn--secondary"
              onClick={onClose}
            >
              Batal
            </button>
            <button type="submit" className="cat-btn cat-btn--primary">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

