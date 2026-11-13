'use client'

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { AlertIcon, CloseIcon, ImageIcon, InfoIcon, UploadIcon } from '@/components/ui/AuthIcons'
import type { BookingRequirementsValue } from '@/types/booking-requirements'

interface BookingRequirementsFormProps {
  value: BookingRequirementsValue
  onChange: (value: BookingRequirementsValue) => void
  readOnly?: boolean
  disabled?: boolean
}

interface LocalPhoto {
  file: File
  url: string
}

const ACCEPT = 'image/*'

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BookingRequirementsForm({ value, onChange, readOnly = false, disabled = false }: BookingRequirementsFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const photosRef = useRef<LocalPhoto[]>([])
  const notesId = useId()
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const locked = readOnly || disabled

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), [])

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!selected.length || locked) return

    const invalid = selected.find((file) => !file.type.startsWith('image/') || file.size === 0)
    if (invalid) {
      setFileError('Format foto tidak didukung atau file kosong.')
      return
    }

    setFileError(null)
    const next = selected.map((file) => ({ file, url: URL.createObjectURL(file) }))
    setPhotos((current) => [...current, ...next])
    onChange({ ...value, files: [...value.files, ...selected] })
  }

  function removePhoto(index: number) {
    if (locked) return
    const removed = photos[index]
    if (removed) URL.revokeObjectURL(removed.url)
    const nextPhotos = photos.filter((_, photoIndex) => photoIndex !== index)
    setPhotos(nextPhotos)
    onChange({ ...value, files: value.files.filter((_, fileIndex) => fileIndex !== index) })
  }

  function changeNotes(notes: string) {
    onChange({ ...value, notes })
  }

  return (
    <section className="booking-card booking-requirements" aria-labelledby="booking-requirements-title">
      <div className="booking-card__heading">
        <span className="booking-icon"><InfoIcon size={19} /></span>
        <div><span className="booking-eyebrow">Informasi tambahan</span><h2 id="booking-requirements-title">Detail Kebutuhan Pekerjaan</h2></div>
      </div>
      <p className="booking-requirements__description">Tambahkan informasi dan foto referensi agar penyedia jasa lebih memahami pekerjaan yang kamu butuhkan.</p>

      <div className="booking-requirements__field">
        <label className="booking-label" htmlFor={notesId}>Catatan Kebutuhan</label>
        <textarea
          id={notesId}
          className="booking-requirements__textarea"
          value={value.notes}
          readOnly={locked}
          placeholder="Jelaskan secara detail pekerjaan atau permasalahan yang ingin kamu selesaikan..."
          onChange={(event) => changeNotes(event.target.value)}
        />
        <p className="booking-helper">Ceritakan kondisi, kendala, atau kebutuhan khusus agar penyedia jasa dapat memahami pekerjaanmu.</p>
        {readOnly && <p className="booking-requirements__locked"><InfoIcon size={14} />Detail kebutuhan ini tidak dapat diubah pada tahap booking saat ini.</p>}
      </div>

      <div className="booking-requirements__field">
        <div><h3 className="booking-subheading">Foto Referensi Pekerjaan</h3><p className="booking-helper">Unggah foto kondisi atau bagian yang membutuhkan pengerjaan agar penyedia jasa mendapatkan gambaran lebih jelas.</p></div>
        {!locked && <button type="button" className="booking-upload" onClick={() => inputRef.current?.click()}><UploadIcon size={18} /><span><strong>Unggah Foto Referensi</strong><small>Klik untuk memilih foto dari perangkatmu</small></span><b>Pilih Foto</b></button>}
        <input ref={inputRef} className="booking-file-input" type="file" accept={ACCEPT} multiple={!readOnly} onChange={chooseFiles} aria-label="Pilih foto referensi pekerjaan" />
        {fileError && <p className="booking-error" role="alert"><AlertIcon size={15} />{fileError}</p>}
        {photos.length > 0 && <div className="booking-photo-grid" aria-label="Preview foto yang dipilih">{photos.map((photo, index) => <div className="booking-photo" key={`${photo.file.name}-${index}`}><img src={photo.url} alt={`Preview ${photo.file.name}`} /><div className="booking-photo__meta"><span title={photo.file.name}>{photo.file.name}</span><small>{formatFileSize(photo.file.size)}</small></div>{!locked && <button type="button" className="booking-photo__remove" aria-label={`Hapus ${photo.file.name}`} onClick={() => removePhoto(index)}><CloseIcon size={15} /></button>}</div>)}</div>}
        <p className="booking-requirements__pending"><InfoIcon size={14} />Validasi ukuran, jumlah, dan penyimpanan permanen foto akan mengikuti backend TPR-78/TPR-79.</p>
      </div>
    </section>
  )
}
