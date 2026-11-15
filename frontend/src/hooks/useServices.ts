'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { INITIAL_MOCK_CATEGORIES } from '@/data/mock-categories'
import {
  DEFAULT_DEMO_PROVIDER_ID,
  INITIAL_MOCK_SERVICES,
} from '@/data/mock-services'
import { ApiError, categoryApi, serviceApi } from '@/lib/api'
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

function isServiceFallbackError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true

  return (
    err.status === 0 ||
    err.status === 401 ||
    err.status >= 500 ||
    err.code === 'NETWORK_ERROR' ||
    err.code === 'SERVICE_LISTING_UNAVAILABLE' ||
    err.code === 'SERVICE_TABLE_UNAVAILABLE'
  )
}

function mapApiErrorToServiceFormErrors(err: unknown): ServiceFormErrors {
  if (err instanceof ApiError) {
    const errors: ServiceFormErrors = {}
    if (err.fields?.name) errors.name = err.fields.name
    if (err.fields?.categoryId) errors.categoryId = err.fields.categoryId
    if (err.fields?.description) errors.description = err.fields.description
    if (err.fields?.price) errors.price = err.fields.price

    if (
      !errors.name &&
      !errors.categoryId &&
      !errors.description &&
      !errors.price
    ) {
      errors.general = err.message
    }

    return errors
  }

  return {
    general: 'Terjadi kesalahan saat menyimpan data layanan jasa.',
  }
}

export function useServices(currentProviderId = DEFAULT_DEMO_PROVIDER_ID) {
  const [services, setServices] = useState<ServiceItem[]>(() => [
    ...INITIAL_MOCK_SERVICES,
  ])
  const [categories, setCategories] = useState<Category[]>(() => [
    ...INITIAL_MOCK_CATEGORIES,
  ])
  const [dataSource, setDataSource] = useState<ServiceDataSource>('local')
  const [loading, setLoading] = useState<boolean>(true)
  const [mutating, setMutating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLocalChanges, setHasLocalChanges] = useState<boolean>(false)
  const [lastActionNotice, setLastActionNotice] = useState<string | null>(null)

  const loadServicesAndCategories = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [categoryResult, publicResult] = await Promise.all([
        categoryApi.list().catch(() => null),
        serviceApi.listPublic(),
      ])

      if (categoryResult && categoryResult.categories.length > 0) {
        setCategories(categoryResult.categories)
      }

      let combinedServices = publicResult.services
      try {
        const mineResult = await serviceApi.listMine()
        const byId = new Map<string, ServiceItem>()
        for (const item of mineResult.services) {
          byId.set(item.id, item)
        }
        for (const item of publicResult.services) {
          if (!byId.has(item.id)) {
            byId.set(item.id, item)
          }
        }
        combinedServices = Array.from(byId.values())
      } catch {
        // Unauthenticated visitors or non-provider roles only load public services
      }

      setServices(combinedServices)
      setDataSource('api')
      setHasLocalChanges(false)
    } catch (err) {
      setDataSource('local')
      if (!isServiceFallbackError(err) && err instanceof ApiError) {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadServicesAndCategories()
  }, [loadServicesAndCategories])

  const providerServices = useMemo(() => {
    if (dataSource === 'api') {
      // `services` pada mode API berisi gabungan layanan publik (milik semua
      // provider) dan layanan milik provider yang sedang login. Halaman
      // manajemen provider hanya boleh menampilkan layanan milik akun aktif.
      return services.filter((item) => item.providerId === currentProviderId)
    }

    return services.filter(
      (item) =>
        item.providerId === currentProviderId ||
        item.providerId === DEFAULT_DEMO_PROVIDER_ID
    )
  }, [services, currentProviderId, dataSource])

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

      const parsedPrice = parseServicePrice(input.price)!
      const payload = {
        categoryId: input.categoryId.trim(),
        name: input.name.trim().replace(/\s+/g, ' '),
        description: input.description.trim(),
        price: parsedPrice,
        isActive: input.isActive,
      }

      if (dataSource === 'api') {
        setMutating(true)
        try {
          const result = await serviceApi.create(payload)
          setServices((current) => [result.service, ...current])
          const notice =
            result.message ??
            `Layanan "${result.service.name}" berhasil ditambahkan.`
          setLastActionNotice(notice)
          return { ok: true, service: result.service, message: notice }
        } catch (err) {
          if (!isServiceFallbackError(err)) {
            return {
              ok: false,
              errors: mapApiErrorToServiceFormErrors(err),
            }
          }
          setDataSource('local')
        } finally {
          setMutating(false)
        }
      }

      const selectedCategory = categories.find(
        (cat) => cat.id === payload.categoryId
      )
      const now = new Date().toISOString()

      const newService: ServiceItem = {
        id: `svc-local-${Date.now()}`,
        providerId: currentProviderId,
        providerName: 'Penyedia Jasa LOKA',
        categoryId: payload.categoryId,
        categoryName: selectedCategory?.name ?? 'Kategori Umum',
        name: payload.name,
        description: payload.description,
        price: payload.price,
        isActive: payload.isActive,
        createdAt: now,
        updatedAt: now,
      }

      setServices((current) => [newService, ...current])
      setHasLocalChanges(true)
      const notice = `Layanan "${newService.name}" berhasil ditambahkan.`
      setLastActionNotice(notice)

      return { ok: true, service: newService, message: notice }
    },
    [categories, currentProviderId, dataSource, validateServiceInput]
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
        dataSource === 'local' &&
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

      const parsedPrice = parseServicePrice(input.price)!
      const payload = {
        categoryId: input.categoryId.trim(),
        name: input.name.trim().replace(/\s+/g, ' '),
        description: input.description.trim(),
        price: parsedPrice,
        isActive: input.isActive,
      }

      if (dataSource === 'api') {
        setMutating(true)
        try {
          const result = await serviceApi.update(id, payload)
          setServices((current) =>
            current.map((item) => (item.id === id ? result.service : item))
          )
          const notice =
            result.message ??
            `Layanan "${result.service.name}" berhasil diperbarui.`
          setLastActionNotice(notice)
          return { ok: true, service: result.service, message: notice }
        } catch (err) {
          if (!isServiceFallbackError(err)) {
            return {
              ok: false,
              errors: mapApiErrorToServiceFormErrors(err),
            }
          }
          setDataSource('local')
        } finally {
          setMutating(false)
        }
      }

      const selectedCategory = categories.find(
        (cat) => cat.id === payload.categoryId
      )

      const updated: ServiceItem = {
        ...existing,
        categoryId: payload.categoryId,
        categoryName: selectedCategory?.name ?? existing.categoryName,
        name: payload.name,
        description: payload.description,
        price: payload.price,
        isActive: payload.isActive,
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
    [categories, currentProviderId, dataSource, services, validateServiceInput]
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
        dataSource === 'local' &&
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

      const nextStatus = !existing.isActive

      if (dataSource === 'api') {
        setMutating(true)
        try {
          const result = await serviceApi.update(id, { isActive: nextStatus })
          setServices((current) =>
            current.map((item) => (item.id === id ? result.service : item))
          )
          const notice = result.service.isActive
            ? `Layanan "${result.service.name}" diaktifkan kembali dan tampil ke pelanggan.`
            : `Layanan "${result.service.name}" dinonaktifkan dari pencarian pelanggan.`
          setLastActionNotice(notice)
          return { ok: true, service: result.service, message: notice }
        } catch (err) {
          if (!isServiceFallbackError(err) && err instanceof ApiError) {
            return {
              ok: false,
              code: err.code,
              message: err.message,
            }
          }
          setDataSource('local')
        } finally {
          setMutating(false)
        }
      }

      const updated: ServiceItem = {
        ...existing,
        isActive: nextStatus,
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
    [currentProviderId, dataSource, services]
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
        dataSource === 'local' &&
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

      if (dataSource === 'api') {
        setMutating(true)
        try {
          const result = await serviceApi.remove(id)
          setServices((current) => current.filter((item) => item.id !== id))
          const notice =
            result.message ??
            `Layanan "${target.name}" berhasil dihapus dari daftar jasa.`
          setLastActionNotice(notice)
          return { ok: true, service: target, message: notice }
        } catch (err) {
          if (!isServiceFallbackError(err) && err instanceof ApiError) {
            return {
              ok: false,
              code: err.code,
              message: err.message,
            }
          }
          setDataSource('local')
        } finally {
          setMutating(false)
        }
      }

      setServices((current) => current.filter((item) => item.id !== id))
      setHasLocalChanges(true)
      const notice = `Layanan "${target.name}" berhasil dihapus dari daftar jasa.`
      setLastActionNotice(notice)

      return { ok: true, service: target, message: notice }
    },
    [currentProviderId, dataSource, services]
  )

  const reloadServices = useCallback(() => {
    void loadServicesAndCategories()
  }, [loadServicesAndCategories])

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
