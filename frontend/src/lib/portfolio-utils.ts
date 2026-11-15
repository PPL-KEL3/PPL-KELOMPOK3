import {
  PORTFOLIO_ALLOWED_CONTENT_TYPES,
  PORTFOLIO_ALLOWED_EXTENSIONS,
  PORTFOLIO_DESCRIPTION_MAX,
  PORTFOLIO_MAX_FILE_SIZE,
  PORTFOLIO_MAX_ITEMS,
  PORTFOLIO_TITLE_MAX,
  PORTFOLIO_TITLE_MIN,
  type PortfolioContentType,
  type PortfolioFormErrors,
  type PortfolioFormInput,
} from '@/types/portfolio'

export function normalizePortfolioTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ')
}

/** "7,2 MB" / "850 KB" (format Indonesia). */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('id-ID')} KB`
}

/** "8 Nov 2026" */
export function formatPortfolioDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function isAllowedContentType(type: string): type is PortfolioContentType {
  return (PORTFOLIO_ALLOWED_CONTENT_TYPES as readonly string[]).includes(type)
}

/** Validasi lapis frontend (UX). Backend dan bucket tetap memvalidasi ulang. */
export function validatePortfolioFile(file: File): string | null {
  const name = file.name.toLowerCase()
  const extensionOk = PORTFOLIO_ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))
  if (!isAllowedContentType(file.type) || !extensionOk) {
    return 'Format file tidak didukung. Gunakan foto JPG atau PNG.'
  }
  if (file.size > PORTFOLIO_MAX_FILE_SIZE) {
    return `Ukuran file ${formatFileSize(file.size)} melebihi batas 5 MB. Pilih foto lain.`
  }
  if (file.size === 0) {
    return 'File kosong. Pilih foto lain.'
  }
  return null
}

export function validatePortfolioInput(input: PortfolioFormInput): PortfolioFormErrors {
  const errors: PortfolioFormErrors = {}
  const title = normalizePortfolioTitle(input.title)
  if (!title) errors.title = 'Judul wajib diisi.'
  else if (title.length < PORTFOLIO_TITLE_MIN) {
    errors.title = `Judul minimal ${PORTFOLIO_TITLE_MIN} karakter.`
  } else if (title.length > PORTFOLIO_TITLE_MAX) {
    errors.title = `Judul maksimal ${PORTFOLIO_TITLE_MAX} karakter.`
  }

  if (input.description.trim().length > PORTFOLIO_DESCRIPTION_MAX) {
    errors.description = `Deskripsi maksimal ${PORTFOLIO_DESCRIPTION_MAX} karakter.`
  }
  return errors
}

export function hasPortfolioErrors(errors: PortfolioFormErrors): boolean {
  return Object.values(errors).some(Boolean)
}

export function isPortfolioLimitReached(count: number): boolean {
  return count >= PORTFOLIO_MAX_ITEMS
}
