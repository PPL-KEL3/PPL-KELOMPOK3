'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ApiError,
  categoryApi,
  providerProfileApi,
  type ProviderProfilePayload,
} from '@/lib/api'
import type { Category } from '@/types/category'
import type {
  ProviderProfile,
  ProviderProfileFormErrors,
  ProviderProfileFormInput,
} from '@/types/provider'

export type ProviderProfileMutationResult =
  | { ok: true; profile: ProviderProfile; message: string }
  | { ok: false; errors: ProviderProfileFormErrors }

function mapApiErrorToFormErrors(error: unknown): ProviderProfileFormErrors {
  if (error instanceof ApiError) {
    const fields = error.fields ?? {}
    const errors: ProviderProfileFormErrors = {}

    if (fields.businessName) errors.businessName = fields.businessName
    if (fields.bio) errors.bio = fields.bio
    if (fields.whatsappNumber) errors.whatsappNumber = fields.whatsappNumber
    if (fields.address) errors.address = fields.address
    if (fields.serviceArea) errors.serviceArea = fields.serviceArea
    if (fields.operatingHours) errors.operatingHours = fields.operatingHours
    if (fields.primaryCategoryId) {
      errors.primaryCategoryId = fields.primaryCategoryId
    }
    if (fields.isPublic) errors.isPublic = fields.isPublic

    if (Object.keys(errors).length === 0) {
      errors.general = error.message
    }

    return errors
  }

  return {
    general: 'Terjadi kesalahan saat menyimpan profil penyedia.',
  }
}

function toPayload(input: ProviderProfileFormInput): ProviderProfilePayload {
  return {
    businessName: input.businessName,
    bio: input.bio.trim() ? input.bio.trim() : null,
    whatsappNumber: input.whatsappNumber,
    address: input.address,
    serviceArea: input.serviceArea,
    operatingHours: input.operatingHours,
    primaryCategoryId: input.primaryCategoryId,
    isPublic: input.isPublic,
  }
}

export function useProviderProfile() {
  const [profile, setProfile] = useState<ProviderProfile | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setCategoriesError(null)

    const [profileResult, categoryResult] = await Promise.allSettled([
      providerProfileApi.getMine(),
      categoryApi.list(),
    ])

    if (profileResult.status === 'fulfilled') {
      setProfile(profileResult.value.profile)
    } else {
      setProfile(null)
      setError(
        profileResult.reason instanceof ApiError
          ? profileResult.reason.message
          : 'Tidak dapat memuat profil penyedia. Silakan coba lagi.'
      )
    }

    if (categoryResult.status === 'fulfilled') {
      setCategories(categoryResult.value.categories)
    } else {
      setCategories([])
      setCategoriesError(
        'Daftar kategori belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.'
      )
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveProfile = useCallback(
    async (
      input: ProviderProfileFormInput
    ): Promise<ProviderProfileMutationResult> => {
      setSaving(true)

      try {
        const result = await providerProfileApi.upsertMine(toPayload(input))
        if (!result.profile) {
          return {
            ok: false,
            errors: {
              general: 'Profil penyedia gagal disimpan. Silakan coba lagi.',
            },
          }
        }

        setProfile(result.profile)
        return {
          ok: true,
          profile: result.profile,
          message: result.message ?? 'Profil penyedia berhasil disimpan.',
        }
      } catch (err) {
        return { ok: false, errors: mapApiErrorToFormErrors(err) }
      } finally {
        setSaving(false)
      }
    },
    []
  )

  const toggleVisibility = useCallback(
    async (nextValue: boolean): Promise<ProviderProfileMutationResult> => {
      if (!profile) {
        return {
          ok: false,
          errors: {
            general: 'Simpan profil penyedia terlebih dahulu sebelum mengubah status publikasi.',
          },
        }
      }

      setSaving(true)

      try {
        const result = await providerProfileApi.updateMine({
          isPublic: nextValue,
        })
        if (!result.profile) {
          return {
            ok: false,
            errors: {
              general: 'Status publikasi profil gagal diperbarui. Silakan coba lagi.',
            },
          }
        }

        setProfile(result.profile)
        return {
          ok: true,
          profile: result.profile,
          message:
            result.message ??
            (nextValue
              ? 'Profil penyedia dipublikasikan.'
              : 'Profil penyedia disembunyikan dari publik.'),
        }
      } catch (err) {
        return { ok: false, errors: mapApiErrorToFormErrors(err) }
      } finally {
        setSaving(false)
      }
    },
    [profile]
  )

  return {
    profile,
    categories,
    loading,
    saving,
    error,
    categoriesError,
    saveProfile,
    toggleVisibility,
    reload: load,
  }
}
