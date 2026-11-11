'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiError, serviceAreaApi } from '@/lib/api'
import type {
  ServiceArea,
  ServiceAreaFormErrors,
  ServiceAreaFormInput,
} from '@/types/provider'

export type ServiceAreaMutationResult =
  | {
      ok: true
      serviceArea: ServiceArea
      serviceAreas: ServiceArea[]
      message: string
    }
  | { ok: false; errors: ServiceAreaFormErrors }

function mapApiErrorToFormErrors(error: unknown): ServiceAreaFormErrors {
  if (error instanceof ApiError) {
    const fields = error.fields ?? {}
    const errors: ServiceAreaFormErrors = {}

    if (fields.areaName) errors.areaName = fields.areaName
    if (fields.radiusKm) errors.radiusKm = fields.radiusKm

    if (Object.keys(errors).length === 0) {
      errors.general = error.message
    }

    return errors
  }

  return {
    general: 'Terjadi kesalahan saat menyimpan wilayah layanan.',
  }
}

function parseRadiusKm(value: string): number {
  return Number(value.replace(',', '.').trim())
}

export function useProviderServiceAreas() {
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([])
  const [loading, setLoading] = useState(true)
  const [mutating, setMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await serviceAreaApi.listMine()
      setServiceAreas(result.serviceAreas)
    } catch (err) {
      setServiceAreas([])
      setError(
        err instanceof ApiError
          ? err.message
          : 'Tidak dapat memuat wilayah layanan. Silakan coba lagi.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createServiceArea = useCallback(
    async (input: ServiceAreaFormInput): Promise<ServiceAreaMutationResult> => {
      setMutating(true)

      try {
        const result = await serviceAreaApi.create({
          areaName: input.areaName,
          radiusKm: parseRadiusKm(input.radiusKm),
        })
        setServiceAreas(result.serviceAreas)
        return {
          ok: true,
          serviceArea: result.serviceArea,
          serviceAreas: result.serviceAreas,
          message: result.message,
        }
      } catch (err) {
        return { ok: false, errors: mapApiErrorToFormErrors(err) }
      } finally {
        setMutating(false)
      }
    },
    []
  )

  const updateServiceArea = useCallback(
    async (
      areaId: string,
      input: ServiceAreaFormInput
    ): Promise<ServiceAreaMutationResult> => {
      setMutating(true)

      try {
        const result = await serviceAreaApi.update(areaId, {
          areaName: input.areaName,
          radiusKm: parseRadiusKm(input.radiusKm),
        })
        setServiceAreas(result.serviceAreas)
        return {
          ok: true,
          serviceArea: result.serviceArea,
          serviceAreas: result.serviceAreas,
          message: result.message,
        }
      } catch (err) {
        return { ok: false, errors: mapApiErrorToFormErrors(err) }
      } finally {
        setMutating(false)
      }
    },
    []
  )

  const deleteServiceArea = useCallback(
    async (areaId: string): Promise<ServiceAreaMutationResult> => {
      setMutating(true)

      try {
        const result = await serviceAreaApi.remove(areaId)
        setServiceAreas(result.serviceAreas)
        return {
          ok: true,
          serviceArea: result.serviceArea,
          serviceAreas: result.serviceAreas,
          message: result.message,
        }
      } catch (err) {
        return { ok: false, errors: mapApiErrorToFormErrors(err) }
      } finally {
        setMutating(false)
      }
    },
    []
  )

  return {
    serviceAreas,
    loading,
    mutating,
    error,
    createServiceArea,
    updateServiceArea,
    deleteServiceArea,
    reload: load,
  }
}
