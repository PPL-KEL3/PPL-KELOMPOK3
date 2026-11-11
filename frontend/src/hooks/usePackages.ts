'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiError, packageApi, serviceApi } from '@/lib/api'
import {
  hasPackageErrors,
  normalizePackageName,
  parsePackagePrice,
  sortPackages,
  validatePackageInput,
} from '@/lib/package-utils'
import type {
  PackageFormErrors,
  PackageFormInput,
  PackageItem,
} from '@/types/package'
import type { ServiceItem } from '@/types/service'

export type PackageMutationResult =
  | { ok: true; package: PackageItem; message: string }
  | { ok: false; errors: PackageFormErrors }

export type PackageActionResult =
  | { ok: true; package: PackageItem; message: string }
  | { ok: false; message: string }

interface PackagesState {
  serviceId: string | null
  packages: PackageItem[]
  error: string | null
}

const LOAD_ERROR = 'Gagal memuat daftar paket.'
const SAVE_ERROR = 'Gagal menyimpan paket. Coba lagi.'

function toLoadMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.status !== 0 && err.message
    ? err.message
    : fallback
}

function toFormErrors(err: unknown): PackageFormErrors {
  if (!(err instanceof ApiError)) return { general: SAVE_ERROR }

  const errors: PackageFormErrors = {}
  if (err.fields?.name) errors.name = err.fields.name
  if (err.fields?.description) errors.description = err.fields.description
  if (err.fields?.price) errors.price = err.fields.price
  if (err.code === 'DUPLICATE_PACKAGE_NAME' && !errors.name) {
    errors.name = 'Nama paket sudah dipakai di jasa ini.'
  }
  if (!hasPackageErrors(errors)) errors.general = err.message || SAVE_ERROR
  return errors
}

export function usePackages(serviceId: string | null) {
  const [services, setServices] = useState<ServiceItem[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [servicesError, setServicesError] = useState<string | null>(null)
  const [servicesTick, setServicesTick] = useState(0)

  const [state, setState] = useState<PackagesState>({
    serviceId: null,
    packages: [],
    error: null,
  })
  const [packagesTick, setPackagesTick] = useState(0)
  const [mutating, setMutating] = useState(false)

  useEffect(() => {
    let cancelled = false
    setServicesLoading(true)
    setServicesError(null)

    serviceApi
      .listMine()
      .then((result) => {
        if (cancelled) return
        setServices(result.services)
      })
      .catch((err) => {
        if (cancelled) return
        setServices([])
        setServicesError(toLoadMessage(err, 'Gagal memuat daftar jasa.'))
      })
      .finally(() => {
        if (!cancelled) setServicesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [servicesTick])

  useEffect(() => {
    if (!serviceId) return
    let cancelled = false

    packageApi
      .listMine(serviceId)
      .then((result) => {
        if (cancelled) return
        setState({
          serviceId,
          packages: sortPackages(result.packages),
          error: null,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          serviceId,
          packages: [],
          error: toLoadMessage(err, LOAD_ERROR),
        })
      })

    return () => {
      cancelled = true
    }
  }, [serviceId, packagesTick])

  const packagesReady = serviceId !== null && state.serviceId === serviceId
  const packagesLoading = serviceId !== null && !packagesReady
  const packages = packagesReady ? state.packages : []
  const packagesError = packagesReady ? state.error : null

  const reloadServices = useCallback(() => {
    setServicesTick((tick) => tick + 1)
  }, [])

  const reloadPackages = useCallback(() => {
    setState((current) => ({ ...current, serviceId: null }))
    setPackagesTick((tick) => tick + 1)
  }, [])

  const replaceInState = useCallback((item: PackageItem) => {
    setState((current) => ({
      ...current,
      packages: sortPackages(
        current.packages.map((existing) =>
          existing.id === item.id ? item : existing
        )
      ),
    }))
  }, [])

  const createPackage = useCallback(
    async (input: PackageFormInput): Promise<PackageMutationResult> => {
      if (!serviceId) {
        return { ok: false, errors: { general: 'Pilih jasa terlebih dahulu.' } }
      }

      const errors = validatePackageInput(input, packages)
      if (hasPackageErrors(errors)) return { ok: false, errors }

      setMutating(true)
      try {
        const result = await packageApi.create({
          serviceId,
          name: normalizePackageName(input.name),
          description: input.description.trim() || null,
          price: parsePackagePrice(input.price)!,
          isActive: input.isActive,
        })
        setState((current) => ({
          ...current,
          packages: sortPackages([...current.packages, result.package]),
        }))
        return {
          ok: true,
          package: result.package,
          message: `Paket "${result.package.name}" berhasil ditambahkan.`,
        }
      } catch (err) {
        return { ok: false, errors: toFormErrors(err) }
      } finally {
        setMutating(false)
      }
    },
    [packages, serviceId]
  )

  const updatePackage = useCallback(
    async (
      id: string,
      input: PackageFormInput
    ): Promise<PackageMutationResult> => {
      const errors = validatePackageInput(input, packages, id)
      if (hasPackageErrors(errors)) return { ok: false, errors }

      setMutating(true)
      try {
        const result = await packageApi.update(id, {
          name: normalizePackageName(input.name),
          description: input.description.trim() || null,
          price: parsePackagePrice(input.price)!,
          isActive: input.isActive,
        })
        replaceInState(result.package)
        return {
          ok: true,
          package: result.package,
          message: `Perubahan paket "${result.package.name}" disimpan.`,
        }
      } catch (err) {
        return { ok: false, errors: toFormErrors(err) }
      } finally {
        setMutating(false)
      }
    },
    [packages, replaceInState]
  )

  const togglePackage = useCallback(
    async (item: PackageItem): Promise<PackageActionResult> => {
      setMutating(true)
      try {
        const result = await packageApi.update(item.id, {
          isActive: !item.isActive,
        })
        replaceInState(result.package)
        return {
          ok: true,
          package: result.package,
          message: result.package.isActive
            ? `Paket "${result.package.name}" diaktifkan lagi.`
            : `Paket "${result.package.name}" dinonaktifkan dan tidak tampil ke pelanggan.`,
        }
      } catch (err) {
        return {
          ok: false,
          message:
            err instanceof ApiError && err.status !== 0 && err.message
              ? err.message
              : SAVE_ERROR,
        }
      } finally {
        setMutating(false)
      }
    },
    [replaceInState]
  )

  const deletePackage = useCallback(
    async (item: PackageItem): Promise<PackageActionResult> => {
      setMutating(true)
      try {
        await packageApi.remove(item.id)
        setState((current) => ({
          ...current,
          packages: current.packages.filter(
            (existing) => existing.id !== item.id
          ),
        }))
        return {
          ok: true,
          package: item,
          message: `Paket "${item.name}" dihapus.`,
        }
      } catch (err) {
        return {
          ok: false,
          message:
            err instanceof ApiError && err.status !== 0 && err.message
              ? err.message
              : 'Gagal menghapus paket. Coba lagi.',
        }
      } finally {
        setMutating(false)
      }
    },
    []
  )

  return {
    services,
    servicesLoading,
    servicesError,
    reloadServices,
    packages,
    packagesLoading,
    packagesError,
    reloadPackages,
    mutating,
    createPackage,
    updatePackage,
    togglePackage,
    deletePackage,
  }
}
