'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { AlertIcon } from '@/components/ui/AuthIcons'
import { AuthAlert } from '@/components/auth/AuthAlert'
import type { ProviderProfileMutationResult } from '@/hooks/useProviderProfile'
import {
  DEFAULT_OPERATING_HOURS,
  cloneOperatingHours,
  normalizeOperatingHours,
  validateOperatingHours,
} from '@/lib/operating-hours'
import {
  formatWhatsAppDisplay,
  isValidWhatsAppNumber,
  normalizeWhatsAppNumber,
} from '@/lib/whatsapp'
import type { Category } from '@/types/category'
import type {
  OperatingHours,
  ProviderProfile,
  ProviderProfileFormErrors,
  ProviderProfileFormInput,
} from '@/types/provider'
import { OperatingHoursEditor } from './OperatingHoursEditor'
import { ProviderProfilePreview } from './ProviderProfilePreview'

interface ProviderProfileFormProps {
  initialProfile: ProviderProfile | null
  categories: Category[]
  categoriesError: string | null
  submitting: boolean
  onSubmit: (
    input: ProviderProfileFormInput
  ) => Promise<ProviderProfileMutationResult> | ProviderProfileMutationResult
}

const EMPTY_FORM = {
  businessName: '',
  bio: '',
  whatsappNumber: '',
  address: '',
  serviceArea: '',
}

export function ProviderProfileForm({
  initialProfile,
  categories,
  categoriesError,
  submitting,
  onSubmit,
}: ProviderProfileFormProps) {
  const [businessName, setBusinessName] = useState('')
  const [bio, setBio] = useState('')
  const [whatsappNumber, setWhatsAppNumber] = useState('')
  const [address, setAddress] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [operatingHours, setOperatingHours] = useState<OperatingHours>(
    cloneOperatingHours(DEFAULT_OPERATING_HOURS)
  )
  const [primaryCategoryId, setPrimaryCategoryId] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [errors, setErrors] = useState<ProviderProfileFormErrors>({})

  useEffect(() => {
    if (initialProfile) {
      setBusinessName(initialProfile.businessName)
      setBio(initialProfile.bio ?? '')
      setWhatsAppNumber(initialProfile.whatsappNumber)
      setAddress(initialProfile.address)
      setServiceArea(initialProfile.serviceArea)
      setOperatingHours(normalizeOperatingHours(initialProfile.operatingHours))
      setPrimaryCategoryId(initialProfile.primaryCategory.id)
      setIsPublic(initialProfile.isPublic)
    } else {
      setBusinessName(EMPTY_FORM.businessName)
      setBio(EMPTY_FORM.bio)
      setWhatsAppNumber(EMPTY_FORM.whatsappNumber)
      setAddress(EMPTY_FORM.address)
      setServiceArea(EMPTY_FORM.serviceArea)
      setOperatingHours(cloneOperatingHours(DEFAULT_OPERATING_HOURS))
      setPrimaryCategoryId('')
      setIsPublic(false)
    }

    setErrors({})
  }, [initialProfile])

  useEffect(() => {
    if (!initialProfile && !primaryCategoryId && categories.length > 0) {
      setPrimaryCategoryId(categories[0].id)
    }
  }, [categories, initialProfile, primaryCategoryId])

  function clearError(field: keyof ProviderProfileFormErrors) {
    setErrors((current) => ({ ...current, [field]: undefined, general: undefined }))
  }

  function validate(): ProviderProfileFormErrors {
    const nextErrors: ProviderProfileFormErrors = {}
    const trimmedName = businessName.trim().replace(/\s+/g, ' ')
    const trimmedBio = bio.trim()
    const trimmedAddress = address.trim()
    const trimmedServiceArea = serviceArea.trim()

    if (!trimmedName) {
      nextErrors.businessName = 'Nama usaha wajib diisi.'
    } else if (trimmedName.length < 2) {
      nextErrors.businessName = 'Nama usaha minimal 2 karakter.'
    } else if (trimmedName.length > 80) {
      nextErrors.businessName = 'Nama usaha maksimal 80 karakter.'
    }

    if (trimmedBio.length > 500) {
      nextErrors.bio = 'Bio usaha maksimal 500 karakter.'
    }

    if (!whatsappNumber.trim()) {
      nextErrors.whatsappNumber = 'Nomor WhatsApp wajib diisi.'
    } else if (!isValidWhatsAppNumber(whatsappNumber)) {
      nextErrors.whatsappNumber =
        'Masukkan nomor WhatsApp Indonesia yang valid, contoh 081234567890.'
    }

    if (!trimmedAddress) {
      nextErrors.address = 'Alamat lengkap wajib diisi.'
    } else if (trimmedAddress.length < 5) {
      nextErrors.address = 'Alamat lengkap minimal 5 karakter.'
    } else if (trimmedAddress.length > 255) {
      nextErrors.address = 'Alamat lengkap maksimal 255 karakter.'
    }

    if (!trimmedServiceArea) {
      nextErrors.serviceArea = 'Area layanan wajib diisi.'
    } else if (trimmedServiceArea.length < 3) {
      nextErrors.serviceArea = 'Area layanan minimal 3 karakter.'
    } else if (trimmedServiceArea.length > 100) {
      nextErrors.serviceArea = 'Area layanan maksimal 100 karakter.'
    }

    if (!primaryCategoryId) {
      nextErrors.primaryCategoryId = 'Kategori utama wajib dipilih.'
    }

    const hoursError = validateOperatingHours(operatingHours)
    if (hoursError) {
      nextErrors.operatingHours = hoursError
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
      businessName: businessName.trim().replace(/\s+/g, ' '),
      bio: bio.trim(),
      whatsappNumber: normalizeWhatsAppNumber(whatsappNumber),
      address: address.trim(),
      serviceArea: serviceArea.trim(),
      operatingHours,
      primaryCategoryId,
      isPublic,
    })

    if (!result.ok) {
      setErrors(result.errors)
    }
  }

  const selectedCategory =
    categories.find((category) => category.id === primaryCategoryId)?.name ??
    initialProfile?.primaryCategory.name ??
    ''

  return (
    <div className="prf-layout">
      <form className="prf-form" onSubmit={handleSubmit} noValidate>
        {errors.general && <AuthAlert tone="error">{errors.general}</AuthAlert>}

        {categoriesError && <AuthAlert tone="warning">{categoriesError}</AuthAlert>}

        <div className={`auth-field ${errors.businessName ? 'auth-field--error' : ''}`}>
          <div className="prf-field-head">
            <label htmlFor="provider-business-name">
              Nama Usaha / Penyedia Jasa{' '}
              <span className="prf-required-mark" aria-hidden="true">
                *
              </span>
            </label>
            <span className="prf-required-badge">Wajib diisi</span>
          </div>
          <input
            id="provider-business-name"
            className="prf-input"
            type="text"
            value={businessName}
            disabled={submitting}
            onChange={(event) => {
              setBusinessName(event.target.value)
              clearError('businessName')
            }}
            placeholder="Contoh: Bengkel Bangunan Pak Rahmat"
            maxLength={80}
            aria-invalid={errors.businessName ? true : undefined}
          />
          {errors.businessName ? (
            <p className="auth-field__error">
              <AlertIcon size={14} />
              <span>{errors.businessName}</span>
            </p>
          ) : (
            <p className="auth-field__hint">
              Nama ini akan tampil pada halaman profil publik dan katalog layanan.
            </p>
          )}
        </div>

        <div className={`auth-field ${errors.bio ? 'auth-field--error' : ''}`}>
          <div className="prf-field-head">
            <label htmlFor="provider-bio">Bio / Tentang Usaha</label>
            <span className="prf-char-count">{bio.length}/500</span>
          </div>
          <textarea
            id="provider-bio"
            className="prf-textarea"
            rows={4}
            value={bio}
            disabled={submitting}
            onChange={(event) => {
              setBio(event.target.value)
              clearError('bio')
            }}
            placeholder="Ceritakan keahlian, pengalaman, dan keunggulan usaha kamu."
            maxLength={500}
            aria-invalid={errors.bio ? true : undefined}
          />
          {errors.bio ? (
            <p className="auth-field__error">
              <AlertIcon size={14} />
              <span>{errors.bio}</span>
            </p>
          ) : (
            <p className="auth-field__hint">
              Direkomendasikan agar pelanggan lebih mengenal usahamu.
            </p>
          )}
        </div>

        <div className="prf-form-row">
          <div
            className={`auth-field ${errors.whatsappNumber ? 'auth-field--error' : ''}`}
          >
            <div className="prf-field-head">
              <label htmlFor="provider-whatsapp">
                Nomor WhatsApp{' '}
                <span className="prf-required-mark" aria-hidden="true">
                  *
                </span>
              </label>
              <span className="prf-required-badge">Wajib diisi</span>
            </div>
            <input
              id="provider-whatsapp"
              className="prf-input"
              type="tel"
              inputMode="tel"
              value={whatsappNumber}
              disabled={submitting}
              onChange={(event) => {
                setWhatsAppNumber(event.target.value)
                clearError('whatsappNumber')
              }}
              placeholder="081234567890"
              aria-invalid={errors.whatsappNumber ? true : undefined}
            />
            {errors.whatsappNumber ? (
              <p className="auth-field__error">
                <AlertIcon size={14} />
                <span>{errors.whatsappNumber}</span>
              </p>
            ) : isValidWhatsAppNumber(whatsappNumber) ? (
              <p className="auth-field__hint">
                Tampil sebagai {formatWhatsAppDisplay(whatsappNumber)}
              </p>
            ) : (
              <p className="auth-field__hint">
                Nomor Indonesia, otomatis disimpan dalam format 62.
              </p>
            )}
          </div>

          <div
            className={`auth-field ${errors.primaryCategoryId ? 'auth-field--error' : ''}`}
          >
            <div className="prf-field-head">
              <label htmlFor="provider-category">
                Kategori Utama{' '}
                <span className="prf-required-mark" aria-hidden="true">
                  *
                </span>
              </label>
              <span className="prf-required-badge">Wajib dipilih</span>
            </div>
            <select
              id="provider-category"
              className="prf-select"
              value={primaryCategoryId}
              disabled={submitting}
              onChange={(event) => {
                setPrimaryCategoryId(event.target.value)
                clearError('primaryCategoryId')
              }}
              aria-invalid={errors.primaryCategoryId ? true : undefined}
            >
              <option value="">Pilih kategori utama...</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.primaryCategoryId ? (
              <p className="auth-field__error">
                <AlertIcon size={14} />
                <span>{errors.primaryCategoryId}</span>
              </p>
            ) : (
              <p className="auth-field__hint">
                Kategori yang paling menggambarkan layanan utama kamu.
              </p>
            )}
          </div>
        </div>

        <div className={`auth-field ${errors.address ? 'auth-field--error' : ''}`}>
          <div className="prf-field-head">
            <label htmlFor="provider-address">
              Alamat Lengkap{' '}
              <span className="prf-required-mark" aria-hidden="true">
                *
              </span>
            </label>
            <span className="prf-required-badge">Wajib diisi</span>
          </div>
          <textarea
            id="provider-address"
            className="prf-textarea prf-textarea--short"
            rows={2}
            value={address}
            disabled={submitting}
            onChange={(event) => {
              setAddress(event.target.value)
              clearError('address')
            }}
            placeholder="Contoh: Jl. Cihampelas No. 10, Bandung"
            maxLength={255}
            aria-invalid={errors.address ? true : undefined}
          />
          {errors.address ? (
            <p className="auth-field__error">
              <AlertIcon size={14} />
              <span>{errors.address}</span>
            </p>
          ) : (
            <p className="auth-field__hint">
              Alamat usaha yang dapat digunakan pelanggan sebagai referensi lokasi.
            </p>
          )}
        </div>

        <div
          className={`auth-field ${errors.serviceArea ? 'auth-field--error' : ''}`}
        >
          <div className="prf-field-head">
            <label htmlFor="provider-service-area">
              Area Layanan{' '}
              <span className="prf-required-mark" aria-hidden="true">
                *
              </span>
            </label>
            <span className="prf-required-badge">Wajib diisi</span>
          </div>
          <input
            id="provider-service-area"
            className="prf-input"
            type="text"
            value={serviceArea}
            disabled={submitting}
            onChange={(event) => {
              setServiceArea(event.target.value)
              clearError('serviceArea')
            }}
            placeholder="Contoh: Kecamatan Coblong dan sekitarnya"
            maxLength={100}
            aria-invalid={errors.serviceArea ? true : undefined}
          />
          {errors.serviceArea ? (
            <p className="auth-field__error">
              <AlertIcon size={14} />
              <span>{errors.serviceArea}</span>
            </p>
          ) : (
            <p className="auth-field__hint">
              Jelaskan cakupan wilayah yang kamu layani.
            </p>
          )}
        </div>

        <div className="auth-field">
          <div className="prf-field-head">
            <span className="prf-field-label">
              Jam Operasional{' '}
              <span className="prf-required-mark" aria-hidden="true">
                *
              </span>
            </span>
            <span className="prf-required-badge">Per hari</span>
          </div>
          <OperatingHoursEditor
            value={operatingHours}
            onChange={(next) => {
              setOperatingHours(next)
              clearError('operatingHours')
            }}
            disabled={submitting}
            error={errors.operatingHours}
          />
        </div>

        <label className="prf-toggle-row">
          <input
            type="checkbox"
            checked={isPublic}
            disabled={submitting}
            onChange={(event) => setIsPublic(event.target.checked)}
          />
          <span>
            <strong>Tampilkan profil ke publik</strong>
            <small>
              Jika aktif, pelanggan dapat melihat profil dan menghubungi WhatsApp
              kamu. Kamu bisa mengubahnya kapan saja.
            </small>
          </span>
        </label>

        {errors.isPublic && (
          <p className="auth-field__error">
            <AlertIcon size={14} />
            <span>{errors.isPublic}</span>
          </p>
        )}

        <div className="prf-actions">
          <button
            type="submit"
            className="prf-btn prf-btn--primary"
            disabled={submitting || categories.length === 0}
          >
            {submitting && <span className="auth-spinner" aria-hidden="true" />}
            <span>{submitting ? 'Menyimpan...' : 'Simpan Profil'}</span>
          </button>
        </div>
      </form>

      <ProviderProfilePreview
        businessName={businessName}
        bio={bio}
        whatsappNumber={whatsappNumber}
        address={address}
        serviceArea={serviceArea}
        operatingHours={operatingHours}
        categoryName={selectedCategory}
        isPublic={isPublic}
      />
    </div>
  )
}
