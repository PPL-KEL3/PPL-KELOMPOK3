'use client'

import { useCallback, useMemo, useState } from 'react'
import { INITIAL_MOCK_CATEGORIES } from '@/data/mock-categories'
import {
  DEFAULT_DEMO_PROVIDER_ID,
  INITIAL_MOCK_SERVICES,
} from '@/data/mock-services'
import type { Category } from '@/types/category'
import type {
  ServiceFormErrors,
  ServiceFormInput,
  ServiceItem,
} from '@/types/service'

export type ServiceDataSource = 'api' | 'local'

export type ServiceMutationResult =
  | { ok: true; service: ServiceItem; message: string }
  | { ok: false; errors: ServiceFormErrors }

export type ServiceActionResult =
  | { ok: true; service: ServiceItem; message: string }
  | { ok: false; message: string; code?: string }

const MIN_SERVICE_NAME_LENGTH = 3
const MAX_SERVICE_NAME_LENGTH = 100
const MIN_SERVICE_DESCRIPTION_LENGTH = 10
const MAX_SERVICE_DESCRIPTION_LENGTH = 500
const MIN_SERVICE_PRICE = 1000
const MAX_SERVICE_PRICE = 100000000

export function parseServicePrice(rawPrice: string | number): number | null {
  if (typeof rawPrice === 'number') {
    if (!Number.isFinite(rawPrice) || !Number.isInteger(rawPrice)) return null
    return rawPrice
  }

  const cleaned = rawPrice.trim().replace(/[.\s]/g, '')
  if (!cleaned || !/^\d+$/.test(cleaned)) {
    return null
  }

  const parsed = Number.parseInt(cleaned, 10)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function useServices(currentProviderId = DEFAULT_DEMO_PROVIDER_ID) {
  const [services, setServices] = useState<ServiceItem[]>(() => [
    ...INITIAL_MOCK_SERVICES,
  ])
  const [categories] = useState<Category[]>(() => [...INITIAL_MOCK_CATEGORIES])
  const [dataSource] = useState<ServiceDataSource>('local')
  const [loading, setLoading] = useState<boolean>(false)
  const [mutating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLocalChanges, setHasLocalChanges] = useState<boolean>(false)
  const [lastActionNotice, setLastActionNotice] = useState<string | null>(null)

  const providerServices = useMemo(
    () =>
      services.filter(
        (item) =>
          item.providerId === currentProviderId ||
          item.providerId === DEFAULT_DEMO_PROVIDER_ID
      ),
    [services, currentProviderId]
  )

  const publicServices = useMemo(
    () => services.filter((item) => item.isActive),
    [services]
  )

  const validateServiceInput = useCallback(
    (input: ServiceFormInput): ServiceFormErrors => {
      const errors: ServiceFormErrors = {}
      const trimmedName = input.name.trim().replace(/\s+/g, ' ')
      const trimmedCategory = input.categoryId.trim()
      const trimmedDescription = input.description.trim()

      if (!trimmedName) {
        errors.name = 'Nama layanan jasa wajib diisi.'
      } else if (trimmedName.length < MIN_SERVICE_NAME_LENGTH) {
        errors.name = `Nama layanan minimal terdiri dari ${MIN_SERVICE_NAME_LENGTH} karakter.`
      } else if (trimmedName.length > MAX_SERVICE_NAME_LENGTH) {
        errors.name = `Nama layanan maksimal ${MAX_SERVICE_NAME_LENGTH} karakter.`
      }

      if (!trimmedCategory) {
        errors.categoryId = 'Kategori layanan wajib dipilih.'
      } else if (!categories.some((cat) => cat.id === trimmedCategory)) {
        errors.categoryId = 'Kategori layanan yang dipilih tidak ditemukan.'
      }

      if (!trimmedDescription) {
        errors.description = 'Deskripsi layanan wajib diisi.'
      } else if (trimmedDescription.length < MIN_SERVICE_DESCRIPTION_LENGTH) {
        errors.description = `Deskripsi layanan minimal terdiri dari ${MIN_SERVICE_DESCRIPTION_LENGTH} karakter.`
      } else if (trimmedDescription.length > MAX_SERVICE_DESCRIPTION_LENGTH) {
        errors.description = `Deskripsi layanan maksimal ${MAX_SERVICE_DESCRIPTION_LENGTH} karakter.`
      }

      const rawPrice = input.price.trim()
      if (!rawPrice) {
        errors.price = 'Harga layanan wajib diisi.'
      } else {
        const numericPrice = parseServicePrice(rawPrice)
        if (numericPrice === null) {
          errors.price = 'Harga layanan harus berupa angka bulat dalam Rupiah.'
        } else if (numericPrice < MIN_SERVICE_PRICE) {
          errors.price = 'Harga layanan minimal Rp 1.000.'
        } else if (numericPrice > MAX_SERVICE_PRICE) {
          errors.price = 'Harga layanan maksimal Rp 100.000.000.'
        }
      }

      return errors
    },
    [categories]
  )

  const createService = useCallback(
    async (input: ServiceFormInput): Promise<ServiceMutationResult> => {
      const errors = validateServiceInput(input)
      if (
        errors.name ||
        errors.categoryId ||
        errors.description ||
        errors.price
      ) {
        return { ok: false, errors }
      }

      const selectedCategory = categories.find(
        (cat) => cat.id === input.categoryId.trim()
      )
      const parsedPrice = parseServicePrice(input.price)!
      const now = new Date().toISOString()

      const newService: ServiceItem = {
        id: `svc-local-${Date.now()}`,
        providerId: currentProviderId,
        providerName: 'Penyedia Jasa LOKA',
        categoryId: input.categoryId.trim(),
        categoryName: selectedCategory?.name ?? 'Kategori Umum',
        name: input.name.trim().replace(/\s+/g, ' '),
        description: input.description.trim(),
        price: parsedPrice,
        isActive: input.isActive,
        createdAt: now,
        updatedAt: now,
      }

      setServices((current) => [newService, ...current])
      setHasLocalChanges(true)
      const notice = `Layanan "${newService.name}" berhasil ditambahkan.`
      setLastActionNotice(notice)

      return { ok: true, service: newService, message: notice }
    },
    [categories, currentProviderId, validateServiceInput]
  )

  const updateService = useCallback(
    async (
      id: string,
      input: ServiceFormInput
    ): Promise<ServiceMutationResult> => {
      const errors = validateServiceInput(input)
      if (
        errors.name ||
        errors.categoryId ||
        errors.description ||
        errors.price
      ) {
        return { ok: false, errors }
      }

      const existing = services.find((item) => item.id === id)
      if (!existing) {
        return {
          ok: false,
          errors: { general: 'Layanan jasa yang dipilih tidak ditemukan.' },
        }
      }

      if (
        existing.providerId !== currentProviderId &&
        existing.providerId !== DEFAULT_DEMO_PROVIDER_ID
      ) {
        return {
          ok: false,
          errors: {
            general:
              'Kamu tidak memiliki izin untuk mengubah layanan milik penyedia jasa lain.',
          },
        }
      }

      const selectedCategory = categories.find(
        (cat) => cat.id === input.categoryId.trim()
      )
      const parsedPrice = parseServicePrice(input.price)!

      const updated: ServiceItem = {
        ...existing,
        categoryId: input.categoryId.trim(),
        categoryName: selectedCategory?.name ?? existing.categoryName,
        name: input.name.trim().replace(/\s+/g, ' '),
        description: input.description.trim(),
        price: parsedPrice,
        isActive: input.isActive,
        updatedAt: new Date().toISOString(),
      }

      setServices((current) =>
        current.map((item) => (item.id === id ? updated : item))
      )
      setHasLocalChanges(true)
      const notice = `Layanan "${updated.name}" berhasil diperbarui.`
      setLastActionNotice(notice)

      return { ok: true, service: updated, message: notice }
    },
    [categories, currentProviderId, services, validateServiceInput]
  )

  const toggleServiceStatus = useCallback(
    async (id: string): Promise<ServiceActionResult> => {
      const existing = services.find((item) => item.id === id)
      if (!existing) {
        return {
          ok: false,
          code: 'SERVICE_NOT_FOUND',
          message: 'Layanan jasa tidak ditemukan.',
        }
      }

      if (
        existing.providerId !== currentProviderId &&
        existing.providerId !== DEFAULT_DEMO_PROVIDER_ID
      ) {
        return {
          ok: false,
          code: 'FORBIDDEN',
          message:
            'Kamu tidak memiliki izin untuk mengubah status layanan milik penyedia jasa lain.',
        }
      }

      const updated: ServiceItem = {
        ...existing,
        isActive: !existing.isActive,
        updatedAt: new Date().toISOString(),
      }

      setServices((current) =>
        current.map((item) => (item.id === id ? updated : item))
      )
      setHasLocalChanges(true)
      const notice = updated.isActive
        ? `Layanan "${updated.name}" diaktifkan kembali dan tampil ke pelanggan.`
        : `Layanan "${updated.name}" dinonaktifkan dari pencarian pelanggan.`
      setLastActionNotice(notice)

      return { ok: true, service: updated, message: notice }
    },
    [currentProviderId, services]
  )

  const deleteService = useCallback(
    async (id: string): Promise<ServiceActionResult> => {
      const target = services.find((item) => item.id === id)
      if (!target) {
        return {
          ok: false,
          code: 'SERVICE_NOT_FOUND',
          message: 'Layanan jasa yang akan dihapus tidak ditemukan.',
        }
      }

      if (
        target.providerId !== currentProviderId &&
        target.providerId !== DEFAULT_DEMO_PROVIDER_ID
      ) {
        return {
          ok: false,
          code: 'FORBIDDEN',
          message:
            'Kamu tidak memiliki izin untuk menghapus layanan milik penyedia jasa lain.',
        }
      }

      setServices((current) => current.filter((item) => item.id !== id))
      setHasLocalChanges(true)
      const notice = `Layanan "${target.name}" berhasil dihapus dari daftar jasa.`
      setLastActionNotice(notice)

      return { ok: true, service: target, message: notice }
    },
    [currentProviderId, services]
  )

  const reloadServices = useCallback(() => {
    setLoading(true)
    setError(null)
    setLoading(false)
  }, [])

  const resetMockServices = useCallback(() => {
    setServices([...INITIAL_MOCK_SERVICES])
    setError(null)
    setHasLocalChanges(false)
    setLastActionNotice('Daftar layanan dikembalikan ke data awal.')
  }, [])

  return {
    services: providerServices,
    publicServices,
    categories,
    dataSource,
    loading,
    mutating,
    error,
    hasLocalChanges,
    lastActionNotice,
    validateServiceInput,
    createService,
    updateService,
    toggleServiceStatus,
    deleteService,
    reloadServices,
    resetMockServices,
  }
}

