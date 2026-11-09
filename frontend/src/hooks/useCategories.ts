'use client'

import { useCallback, useState } from 'react'
import { INITIAL_MOCK_CATEGORIES } from '@/data/mock-categories'
import type {
  Category,
  CategoryFormErrors,
  CategoryFormInput,
} from '@/types/category'

export type CategoryMutationResult =
  | { ok: true; category: Category }
  | { ok: false; errors: CategoryFormErrors }

export type CategoryDeleteResult =
  | { ok: true; deletedCategory: Category }
  | { ok: false; message: string }

/**
 * Custom hook pengelolaan state kategori untuk TPR-25.
 * Pada TPR-26, operasi di dalam hook ini akan dihubungkan ke endpoint REST API Express
 * (`/api/categories`) tanpa perlu mengubah struktur komponen presentasi.
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(() => [
    ...INITIAL_MOCK_CATEGORIES,
  ])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLocalChanges, setHasLocalChanges] = useState<boolean>(false)
  const [lastActionNotice, setLastActionNotice] = useState<string | null>(null)

  const validateCategoryInput = useCallback(
    (input: CategoryFormInput, excludeId?: string): CategoryFormErrors => {
      const errors: CategoryFormErrors = {}
      const trimmedName = input.name.trim()

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

      const isDuplicate = categories.some(
        (item) =>
          item.id !== excludeId &&
          item.name.trim().toLowerCase() === trimmedName.toLowerCase()
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
    (input: CategoryFormInput): CategoryMutationResult => {
      const errors = validateCategoryInput(input)
      if (errors.name || errors.description) {
        return { ok: false, errors }
      }

      const now = new Date().toISOString()
      const trimmedDescription = input.description.trim()
      const newCategory: Category = {
        id: `cat-local-${Date.now()}`,
        name: input.name.trim(),
        description: trimmedDescription ? trimmedDescription : null,
        createdAt: now,
        updatedAt: now,
      }

      setCategories((current) => [...current, newCategory])
      setHasLocalChanges(true)
      setLastActionNotice(
        `Kategori "${newCategory.name}" ditambahkan pada state lokal (belum tersimpan permanen ke database).`
      )

      return { ok: true, category: newCategory }
    },
    [validateCategoryInput]
  )

  const updateCategory = useCallback(
    (id: string, input: CategoryFormInput): CategoryMutationResult => {
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

      const trimmedDescription = input.description.trim()
      const updatedCategory: Category = {
        ...existing,
        name: input.name.trim(),
        description: trimmedDescription ? trimmedDescription : null,
        updatedAt: new Date().toISOString(),
      }

      setCategories((current) =>
        current.map((item) => (item.id === id ? updatedCategory : item))
      )
      setHasLocalChanges(true)
      setLastActionNotice(
        `Perubahan pada kategori "${updatedCategory.name}" diterapkan sementara di state lokal.`
      )

      return { ok: true, category: updatedCategory }
    },
    [categories, validateCategoryInput]
  )

  const deleteCategory = useCallback(
    (id: string): CategoryDeleteResult => {
      const target = categories.find((item) => item.id === id)
      if (!target) {
        return {
          ok: false,
          message: 'Kategori yang akan dihapus tidak ditemukan.',
        }
      }

      setCategories((current) => current.filter((item) => item.id !== id))
      setHasLocalChanges(true)
      setLastActionNotice(
        `Kategori "${target.name}" dihapus dari state lokal sementara (belum mengubah database).`
      )

      return { ok: true, deletedCategory: target }
    },
    [categories]
  )

  const reloadCategories = useCallback(() => {
    setLoading(true)
    setError(null)
    setLoading(false)
  }, [])

  const resetMockCategories = useCallback(() => {
    setCategories([...INITIAL_MOCK_CATEGORIES])
    setError(null)
    setHasLocalChanges(false)
    setLastActionNotice('Data mock dikembalikan ke kondisi awal demonstrasi.')
  }, [])

  return {
    categories,
    loading,
    error,
    hasLocalChanges,
    lastActionNotice,
    setError,
    setLoading,
    validateCategoryInput,
    createCategory,
    updateCategory,
    deleteCategory,
    reloadCategories,
    resetMockCategories,
  }
}

