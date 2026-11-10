'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiError, providerProfileApi } from '@/lib/api'
import type { ProviderProfile } from '@/types/provider'
import type { ServiceItem } from '@/types/service'

export function usePublicProvider(providerId: string) {
  const [provider, setProvider] = useState<ProviderProfile | null>(null)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotFound(false)

    try {
      const result = await providerProfileApi.getPublic(providerId)
      setProvider(result.provider)
      setServices(result.services)
    } catch (err) {
      setProvider(null)
      setServices([])

      if (
        err instanceof ApiError &&
        (err.status === 404 || err.code === 'INVALID_PROVIDER_ID')
      ) {
        setNotFound(true)
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Tidak dapat memuat profil penyedia. Silakan coba lagi.'
        )
      }
    } finally {
      setLoading(false)
    }
  }, [providerId])

  useEffect(() => {
    void load()
  }, [load])

  return {
    provider,
    services,
    loading,
    notFound,
    error,
    reload: load,
  }
}
