import {
  MAX_PACKAGES_PER_SERVICE,
  PACKAGE_DESCRIPTION_MAX,
  PACKAGE_NAME_MAX,
  PACKAGE_NAME_MIN,
  PACKAGE_PRICE_MAX,
  PACKAGE_PRICE_MIN,
  type PackageFormErrors,
  type PackageFormInput,
  type PackageItem,
} from '@/types/package'

export function formatRupiah(value: number): string {
  return `Rp ${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

export function normalizePackageName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function parsePackagePrice(raw: string): number | null {
  const cleaned = raw.trim().replace(/[.\s]/g, '')
  if (!/^\d+$/.test(cleaned)) return null
  const parsed = Number.parseInt(cleaned, 10)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function sortPackages(items: PackageItem[]): PackageItem[] {
  return [...items].sort((a, b) => {
    if (a.price !== b.price) return a.price - b.price
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
  })
}

export function isPackageLimitReached(count: number): boolean {
  return count >= MAX_PACKAGES_PER_SERVICE
}

export function validatePackageInput(
  input: PackageFormInput,
  existing: PackageItem[],
  editingId?: string
): PackageFormErrors {
  const errors: PackageFormErrors = {}
  const name = normalizePackageName(input.name)
  const description = input.description.trim()

  if (!name) {
    errors.name = 'Nama paket wajib diisi.'
  } else if (name.length < PACKAGE_NAME_MIN) {
    errors.name = `Nama paket minimal ${PACKAGE_NAME_MIN} karakter.`
  } else if (name.length > PACKAGE_NAME_MAX) {
    errors.name = `Nama paket maksimal ${PACKAGE_NAME_MAX} karakter.`
  } else if (
    existing.some(
      (item) =>
        item.id !== editingId &&
        normalizePackageName(item.name).toLowerCase() === name.toLowerCase()
    )
  ) {
    errors.name = 'Nama paket sudah dipakai di jasa ini.'
  }

  if (description.length > PACKAGE_DESCRIPTION_MAX) {
    errors.description = `Deskripsi maksimal ${PACKAGE_DESCRIPTION_MAX} karakter.`
  }

  if (!input.price.trim()) {
    errors.price = 'Harga paket wajib diisi.'
  } else {
    const price = parsePackagePrice(input.price)
    if (price === null) {
      errors.price = 'Harga harus berupa angka bulat dalam Rupiah.'
    } else if (price < PACKAGE_PRICE_MIN) {
      errors.price = `Harga minimal ${formatRupiah(PACKAGE_PRICE_MIN)}.`
    } else if (price > PACKAGE_PRICE_MAX) {
      errors.price = `Harga maksimal ${formatRupiah(PACKAGE_PRICE_MAX)}.`
    }
  }

  return errors
}

export function hasPackageErrors(errors: PackageFormErrors): boolean {
  return Boolean(errors.name || errors.description || errors.price)
}
