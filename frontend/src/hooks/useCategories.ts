'use client'

import { useCallback, useEffect, useState } from 'react'
import { INITIAL_MOCK_CATEGORIES } from '@/data/mock-categories'
import { ApiError, categoryApi } from '@/lib/api'
import type {
  Category,
  CategoryFormErrors,
  CategoryFormInput,
} from '@/types/category'

export type CategoryDataSource = 'api' | 'local'

export type CategoryMutationResult =
  | { ok: true; category: Category; message: string }
  | { ok: false; errors: CategoryFormErrors }

export type CategoryDeleteResult =
  | { ok: true; deletedCategory: Category; message: string }
  | { ok: false; message: string; code?: string }

const FALLBACK_ERROR_CODES = new Set([
  'NETWORK_ERROR',
  'CATEGORY_SERVICE_UNAVAILABLE',
  'CATEGORY_TABLE_UNAVAILABLE',
])

export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function canDeleteCategory(category: Category): boolean {
  return (category.usageCount ?? 0) === 0
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(() => [
    ...INITIAL_MOCK_CATEGORIES,
  ])
  const [dataSource, setDataSource] = useState<CategoryDataSource>('local')
  const [loading, setLoading] = useState<boolean>(true)
  const [mutating, setMutating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLocalChanges, setHasLocalChanges] = useState<boolean>(false)
  const [lastActionNotice, setLastActionNotice] = useState<string | null>(null)

  const loadCategories = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await categoryApi.list()
      setCategories(result.categories)
      setDataSource('api')
      setHasLocalChanges(false)
      setLastActionNotice(null)
    } catch (err) {
      if (err instanceof ApiError && FALLBACK_ERROR_CODES.has(err.code)) {
        setDataSource('local')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setDataSource('local')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  const validateCategoryInput = useCallback(
    (input: CategoryFormInput, excludeId?: string): CategoryFormErrors => {
      const errors: CategoryFormErrors = {}
      const trimmedName = input.name.trim().replace(/\s+/g, ' ')

      if (!trimmedName) {
        errors.name = 'Nama kategori wajib diisi.'
        return errors
      }

      if (trimmedName.length < 2) {
        errors.name = 'Nama kategori minimal terdiri dari 2 karakter.'
        return errors
      }

      if (trimmedName.length > 80) {
        errors.name = 'Nama kategori maksimal 80 karakter.'
        return errors
      }

      const normalizedCandidate = normalizeCategoryName(trimmedName)
      const isDuplicate = categories.some(
        (item) =>
          item.id !== excludeId &&
          normalizeCategoryName(item.name) === normalizedCandidate
      )

      if (isDuplicate) {
        errors.name =
          'Nama kategori sudah digunakan. Gunakan nama kategori yang berbeda.'
      }

      if (input.description.trim().length > 350) {
        errors.description = 'Deskripsi kategori maksimal 350 karakter.'
      }

      return errors
    },
    [categories]
  )

  const createCategory = useCallback(
    async (input: CategoryFormInput): Promise<CategoryMutationResult> => {
      const errors = validateCategoryInput(input)
      if (errors.name || errors.description) {
        return { ok: false, errors }
      }

      const normalizedName = input.name.trim().replace(/\s+/g, ' ')
      const trimmedDescription = input.description.trim()
      const descriptionPayload = trimmedDescription ? trimmedDescription : null

      if (dataSource === 'api') {
        setMutating(true)
        try {
          const response = await categoryApi.create({
            name: normalizedName,
            description: descriptionPayload,
          })

          setCategories((current) => [...current, response.category])
          return {
            ok: true,
            category: response.category,
            message:
              response.message ??
              `Kategori "${response.category.name}" berhasil ditambahkan.`,
          }
        } catch (err) {
          if (err instanceof ApiError) {
            if (err.code === 'CATEGORY_NAME_EXISTS') {
              return {
                ok: false,
                errors: {
                  name:
                    err.fields?.name ??
                    'Nama kategori sudah digunakan. Gunakan nama kategori yang berbeda.',
                },
              }
            }

            if (err.code === 'VALIDATION_ERROR' && err.fields) {
              return {
                ok: false,
                errors: {
                  name: err.fields.name,
                  description: err.fields.description,
                  general: err.message,
                },
              }
            }

            return {
              ok: false,
              errors: { general: err.message },
            }
          }

          return {
            ok: false,
            errors: {
              general: 'Gagal menyimpan kategori baru. Silakan coba lagi.',
            },
          }
        } finally {
          setMutating(false)
        }
      }

      const now = new Date().toISOString()
      const newCategory: Category = {
        id: `cat-local-${Date.now()}`,
        name: normalizedName,
        description: descriptionPayload,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      }

      setCategories((current) => [...current, newCategory])
      setHasLocalChanges(true)
      const notice = `Kategori "${newCategory.name}" berhasil ditambahkan.`
      setLastActionNotice(notice)

      return { ok: true, category: newCategory, message: notice }
    },
    [dataSource, validateCategoryInput]
  )

  const updateCategory = useCallback(
    async (
      id: string,
      input: CategoryFormInput
    ): Promise<CategoryMutationResult> => {
      const errors = validateCategoryInput(input, id)
      if (errors.name || errors.description) {
        return { ok: false, errors }
      }

      const existing = categories.find((item) => item.id === id)
      if (!existing) {
        return {
          ok: false,
          errors: { name: 'Kategori yang dipilih tidak ditemukan.' },
        }
      }

      const normalizedName = input.name.trim().replace(/\s+/g, ' ')
      const trimmedDescription = input.description.trim()
      const descriptionPayload = trimmedDescription ? trimmedDescription : null

      if (dataSource === 'api') {
        setMutating(true)
        try {
          const response = await categoryApi.update(id, {
            name: normalizedName,
            description: descriptionPayload,
          })

          setCategories((current) =>
            current.map((item) => (item.id === id ? response.category : item))
          )

          return {
            ok: true,
            category: response.category,
            message:
              response.message ??
              `Kategori "${response.category.name}" berhasil diperbarui.`,
          }
        } catch (err) {
          if (err instanceof ApiError) {
            if (err.code === 'CATEGORY_NAME_EXISTS') {
              return {
                ok: false,
                errors: {
                  name:
                    err.fields?.name ??
                    'Nama kategori sudah digunakan. Gunakan nama kategori yang berbeda.',
                },
              }
            }

            if (err.code === 'VALIDATION_ERROR' && err.fields) {
              return {
                ok: false,
                errors: {
                  name: err.fields.name,
                  description: err.fields.description,
                  general: err.message,
                },
              }
            }

            return {
              ok: false,
              errors: { general: err.message },
            }
          }

          return {
            ok: false,
            errors: {
              general: 'Gagal memperbarui kategori. Silakan coba lagi.',
            },
          }
        } finally {
          setMutating(false)
        }
      }

      const updatedCategory: Category = {
        ...existing,
        name: normalizedName,
        description: descriptionPayload,
        updatedAt: new Date().toISOString(),
      }

      setCategories((current) =>
        current.map((item) => (item.id === id ? updatedCategory : item))
      )
      setHasLocalChanges(true)
      const notice = `Kategori "${updatedCategory.name}" berhasil diperbarui.`
      setLastActionNotice(notice)

      return { ok: true, category: updatedCategory, message: notice }
    },
    [categories, dataSource, validateCategoryInput]
  )

  const deleteCategory = useCallback(
    async (id: string): Promise<CategoryDeleteResult> => {
      const target = categories.find((item) => item.id === id)
      if (!target) {
        return {
          ok: false,
          code: 'CATEGORY_NOT_FOUND',
          message: 'Kategori yang akan dihapus tidak ditemukan.',
        }
      }

      const linkedCount = target.usageCount ?? 0
      if (linkedCount > 0) {
        return {
          ok: false,
          code: 'CATEGORY_IN_USE',
          message: `Kategori "${target.name}" tidak dapat dihapus karena masih terhubung dengan ${linkedCount} layanan jasa.`,
        }
      }

      if (dataSource === 'api') {
        setMutating(true)
        try {
          const response = await categoryApi.remove(id)
          setCategories((current) => current.filter((item) => item.id !== id))
          return {
            ok: true,
            deletedCategory: response.category,
            message:
              response.message ||
              `Kategori "${target.name}" berhasil dihapus.`,
          }
        } catch (err) {
          if (err instanceof ApiError) {
            return {
              ok: false,
              code: err.code,
              message: err.message,
            }
          }

          return {
            ok: false,
            message: 'Gagal menghapus kategori. Silakan coba lagi.',
          }
        } finally {
          setMutating(false)
        }
      }

      setCategories((current) => current.filter((item) => item.id !== id))
      setHasLocalChanges(true)
      const notice = `Kategori "${target.name}" berhasil dihapus.`
      setLastActionNotice(notice)

      return { ok: true, deletedCategory: target, message: notice }
    },
    [categories, dataSource]
  )

  const reloadCategories = useCallback(() => {
    void loadCategories()
  }, [loadCategories])

  const resetMockCategories = useCallback(() => {
    setCategories([...INITIAL_MOCK_CATEGORIES])
    setError(null)
    setHasLocalChanges(false)
    setLastActionNotice('Daftar kategori dikembalikan ke data awal.')
  }, [])

  return {
    categories,
    dataSource,
    loading,
    mutating,
    error,
    hasLocalChanges,
    lastActionNotice,
    setError,
    setLoading,
    validateCategoryInput,
    canDeleteCategory,
    createCategory,
    updateCategory,
    deleteCategory,
    reloadCategories,
    resetMockCategories,
  }
}
