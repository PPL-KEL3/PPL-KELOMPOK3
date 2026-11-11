'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react'
import { AlertIcon, CheckIcon, CloseIcon } from '@/components/ui/AuthIcons'
import { EditIcon } from '@/components/provider/services/ServiceIcons'
import type { PortfolioMutationResult } from '@/hooks/usePortfolio'
import { validatePortfolioFile } from '@/lib/portfolio-utils'
import {
  PORTFOLIO_DESCRIPTION_MAX,
  PORTFOLIO_TITLE_MAX,
  type PortfolioFormErrors,
  type PortfolioFormInput,
  type PortfolioItem,
} from '@/types/portfolio'
import { FileXIcon, ImageOffIcon, ImagePlusIcon } from './PortfolioIcons'

export type PortfolioModalMode = 'create' | 'edit'

interface PortfolioFormModalProps {
  open: boolean
  mode: PortfolioModalMode
  item?: PortfolioItem | null
  onClose: () => void
  onSubmit: (
    input: PortfolioFormInput,
    file: File | null,
    onProgress: (percent: number) => void
  ) => Promise<PortfolioMutationResult>
}

type Phase = 'idle' | 'uploading' | 'saving'

const EMPTY_FORM: PortfolioFormInput = { title: '', description: '' }
const ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png'
const UPLOAD_DONE_HOLD_MS = 450

function toForm(item: PortfolioItem | null | undefined): PortfolioFormInput {
  if (!item) return EMPTY_FORM
  return { title: item.title, description: item.description ?? '' }
}

export function PortfolioFormModal({
  open,
  mode,
  item = null,
  onClose,
  onSubmit,
}: PortfolioFormModalProps) {
  const titleId = useId()
  const descId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const firstFocusRef = useRef<HTMLButtonElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const savingTimerRef = useRef<number | null>(null)

  const [form, setForm] = useState<PortfolioFormInput>(EMPTY_FORM)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rejectedName, setRejectedName] = useState<string | null>(null)
  const [errors, setErrors] = useState<PortfolioFormErrors>({})
  const [uploadFailed, setUploadFailed] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const isEdit = mode === 'edit'
  const busy = phase !== 'idle'
  const baseline = isEdit ? toForm(item) : EMPTY_FORM
  const dirty =
    form.title !== baseline.title ||
    form.description !== baseline.description ||
    file !== null ||
    rejectedName !== null

  useEffect(() => {
    if (!open) return
    setForm(isEdit ? toForm(item) : EMPTY_FORM)
    setFile(null)
    setPreviewUrl(null)
    setRejectedName(null)
    setErrors({})
    setUploadFailed(false)
    setPhase('idle')
    setProgress(0)
    setConfirmDiscard(false)

    const timer = window.setTimeout(() => {
      if (isEdit) titleInputRef.current?.focus()
      else firstFocusRef.current?.focus()
    }, 30)
    return () => window.clearTimeout(timer)
  }, [open, isEdit, item])

  useEffect(() => clearSavingTimer, [])

  // Pratinjau lokal (URL.createObjectURL) dilepas saat diganti atau modal ditutup.
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  function clearSavingTimer() {
    if (savingTimerRef.current !== null) {
      window.clearTimeout(savingTimerRef.current)
      savingTimerRef.current = null
    }
  }

  function requestClose() {
    if (busy) return
    if (dirty) {
      setConfirmDiscard(true)
      return
    }
    onClose()
  }

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || busy) return
      event.preventDefault()
      if (confirmDiscard) setConfirmDiscard(false)
      else if (dirty) setConfirmDiscard(true)
      else onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, busy, confirmDiscard, dirty, onClose])

  if (!open) return null

  function pickFile() {
    if (!busy) fileInputRef.current?.click()
  }

  function acceptFile(next: File | undefined) {
    if (!next || busy) return
    setUploadFailed(false)
    setErrors((current) => ({ ...current, file: undefined, general: undefined }))

    const error = validatePortfolioFile(next)
    if (error) {
      // File ditolak: pratinjau lama (kalau ada) dibuang, tampilkan nama file + alasannya.
      setFile(null)
      setPreviewUrl(null)
      setRejectedName(next.name)
      setErrors((current) => ({ ...current, file: error }))
      return
    }

    setRejectedName(null)
    setFile(next)
    setPreviewUrl(URL.createObjectURL(next))
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0])
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setDragging(false)
    acceptFile(event.dataTransfer.files?.[0])
  }

  function patch(next: Partial<PortfolioFormInput>, field: 'title' | 'description') {
    setForm((current) => ({ ...current, ...next }))
    if (errors[field] || errors.general) {
      setErrors((current) => ({ ...current, [field]: undefined, general: undefined }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    setUploadFailed(false)
    setProgress(0)
    setPhase(file ? 'uploading' : 'saving')

    // File kecil sering terkirim dalam satu potongan, jadi browser hanya memberi satu event
    // progres (langsung 100%). Bilah 100% ditahan sebentar supaya terlihat selesai,
    // baru label berganti ke "Menyimpan...". Penyimpanan sendiri tidak ikut ditunda.
    const result = await onSubmit(form, file, (percent) => {
      setProgress((current) => Math.max(current, percent))
      if (percent >= 100 && savingTimerRef.current === null) {
        savingTimerRef.current = window.setTimeout(() => {
          savingTimerRef.current = null
          setPhase((current) => (current === 'uploading' ? 'saving' : current))
        }, UPLOAD_DONE_HOLD_MS)
      }
    })

    clearSavingTimer()
    setPhase('idle')
    if (result.ok) {
      onClose()
      return
    }
    setErrors(result.errors)
    setUploadFailed(Boolean(result.uploadFailed))
  }

  const existingPhoto = isEdit ? item?.imageUrl ?? null : null
  const shownPhoto = previewUrl ?? (rejectedName ? null : existingPhoto)
  const fileError = errors.file && !uploadFailed ? errors.file : null
  const canSubmit = !busy && !fileError && (isEdit || file !== null)

  const submitLabel =
    phase === 'uploading'
      ? 'Mengunggah...'
      : phase === 'saving'
        ? 'Menyimpan...'
        : isEdit
          ? 'Simpan Perubahan'
          : 'Simpan Portofolio'

  return (
    <div
      className="pkg-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div
        className="pkg-modal pf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        aria-busy={busy || undefined}
      >
        <div className="pkg-modal__header">
          <div className="pkg-modal__title-group">
            <span className="pkg-modal__icon" aria-hidden="true">
              {isEdit ? <EditIcon size={20} /> : <ImagePlusIcon size={20} />}
            </span>
            <div>
              <span className="dash-card__eyebrow">
                {isEdit ? 'Ubah Portofolio' : 'Portofolio Baru'}
              </span>
              <h2 id={titleId} className="pkg-modal__title">
                {isEdit ? 'Edit Portofolio' : 'Tambah Portofolio'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="pkg-modal__close"
            onClick={requestClose}
            disabled={busy}
            aria-label="Tutup dialog form portofolio"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <p
          id={descId}
          className={`pkg-modal__subtitle${shownPhoto ? ' pf-visually-hidden' : ''}`}
        >
          Unggah foto hasil pekerjaan beserta judul singkat. Foto akan tampil di
          profil publik kamu.
        </p>

        <form className="pkg-form pf-form" onSubmit={handleSubmit} noValidate>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="pf-visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFileChange}
          />

          {shownPhoto ? (
            <div className="pf-preview">
              <img src={shownPhoto} alt={file ? `Pratinjau ${file.name}` : (item?.title ?? '')} />
              {!busy && (
                <button
                  ref={firstFocusRef}
                  type="button"
                  className="pf-preview__change"
                  onClick={pickFile}
                >
                  <ImagePlusIcon size={14} />
                  <span>Ganti Foto</span>
                </button>
              )}
              {phase === 'uploading' && (
                <div className="pf-progress" role="status" aria-live="polite">
                  <span>{progress >= 100 ? 'Foto terunggah 100%' : `Mengunggah… ${progress}%`}</span>
                  <span className="pf-progress__track" aria-hidden="true">
                    <span className="pf-progress__bar" style={{ width: `${progress}%` }} />
                  </span>
                </div>
              )}
            </div>
          ) : (
            <button
              ref={firstFocusRef}
              type="button"
              className={`pf-drop${fileError ? ' pf-drop--error' : ''}${dragging ? ' pf-drop--drag' : ''}`}
              onClick={pickFile}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              disabled={busy}
              aria-describedby={fileError ? `${titleId}-file-error` : undefined}
            >
              <span className="pf-drop__icon" aria-hidden="true">
                {fileError ? <FileXIcon size={18} /> : <ImagePlusIcon size={18} />}
              </span>
              <strong>{fileError && rejectedName ? rejectedName : 'Pilih foto hasil kerja'}</strong>
              <span id={`${titleId}-file-error`}>
                {fileError ?? 'Seret foto ke sini atau klik untuk memilih. JPG atau PNG, maks. 5 MB.'}
              </span>
            </button>
          )}

          {uploadFailed && (
            <div className="pkg-alert pf-upload-failed" role="alert">
              <ImageOffIcon size={16} />
              <div>
                <strong>Foto gagal diunggah.</strong>
                <span>
                  Koneksi terputus saat mengunggah. Coba simpan ulang atau pilih foto
                  lain. Item belum tersimpan.
                </span>
              </div>
              <button type="button" className="pkg-btn pkg-btn--secondary pkg-btn--sm" onClick={pickFile}>
                Pilih Foto Lagi
              </button>
            </div>
          )}

          {shownPhoto && fileError && (
            <p className="pkg-field__error" role="alert">
              <AlertIcon size={14} />
              <span>{fileError}</span>
            </p>
          )}

          <p className="pf-privacy">
            <AlertIcon size={14} />
            <span>Jangan unggah foto KTP atau data pribadi pelanggan.</span>
          </p>

          {errors.general && (
            <div className="pkg-alert" role="alert">
              <AlertIcon size={16} />
              <span>{errors.general}</span>
            </div>
          )}

          <div className={`pkg-field${errors.title ? ' pkg-field--error' : ''}`}>
            <div className="pkg-field__head">
              <label htmlFor="portfolio-title-input">
                Judul Portofolio <span className="pkg-required">*</span>
              </label>
              <span className="pkg-count">Wajib diisi</span>
            </div>
            <input
              ref={titleInputRef}
              id="portfolio-title-input"
              type="text"
              className="pkg-input"
              value={form.title}
              disabled={busy}
              maxLength={PORTFOLIO_TITLE_MAX}
              placeholder="Contoh: Perbaikan atap rumah tipe 36"
              onChange={(event) => patch({ title: event.target.value }, 'title')}
              aria-required="true"
              aria-invalid={errors.title ? true : undefined}
            />
            {errors.title && (
              <p className="pkg-field__error">
                <span>{errors.title}</span>
              </p>
            )}
          </div>

          <div className={`pkg-field${errors.description ? ' pkg-field--error' : ''}`}>
            <div className="pkg-field__head">
              <label htmlFor="portfolio-description-input">Deskripsi (opsional)</label>
              <span className="pkg-count">
                {form.description.length}/{PORTFOLIO_DESCRIPTION_MAX}
              </span>
            </div>
            <textarea
              id="portfolio-description-input"
              className="pkg-textarea"
              rows={3}
              value={form.description}
              disabled={busy}
              maxLength={PORTFOLIO_DESCRIPTION_MAX}
              placeholder="Ceritakan singkat pekerjaan yang kamu lakukan."
              onChange={(event) => patch({ description: event.target.value }, 'description')}
              aria-invalid={errors.description ? true : undefined}
            />
            {errors.description && (
              <p className="pkg-field__error">
                <span>{errors.description}</span>
              </p>
            )}
          </div>

          <div className="pkg-modal__actions pkg-modal__actions--plain">
            <button
              type="button"
              className="pkg-btn pkg-btn--secondary"
              onClick={requestClose}
              disabled={busy}
            >
              Batal
            </button>
            <button type="submit" className="pkg-btn pkg-btn--primary" disabled={!canSubmit}>
              {busy ? (
                <span className="auth-spinner" aria-hidden="true" />
              ) : (
                <CheckIcon size={16} />
              )}
              <span>{submitLabel}</span>
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
              {isEdit
                ? `Perubahan pada portofolio "${item?.title ?? ''}" belum disimpan. Kalau ditutup, perubahan akan hilang.`
                : 'Portofolio baru belum disimpan. Kalau ditutup, foto dan isian akan hilang.'}
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
