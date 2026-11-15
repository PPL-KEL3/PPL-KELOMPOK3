'use client'

import { useCallback, useEffect, useState } from 'react'
import { favoritesApi } from '@/lib/api'
import { useAuth } from '@/components/auth/AuthProvider'
import { useToast } from '@/components/ui/ToastProvider'
import type {
  CreateFavoritePayload,
  FavoriteItem,
  FavoriteItemType,
  UpdateFavoritePayload,
} from '@/types/favorite'

export function useFavorites(initialItemType?: FavoriteItemType) {
  const { user } = useAuth()
  const toast = useToast()
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<FavoriteItemType | 'all'>(
    initialItemType || 'all'
  )
  const [searchQuery, setSearchQuery] = useState<string>('')

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const typeParam = filterType === 'all' ? undefined : filterType
      const res = await favoritesApi.list(typeParam)
      setFavorites(res.favorites || [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat daftar favorit.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [user, filterType])

  useEffect(() => {
    void fetchFavorites()
  }, [fetchFavorites])

  const addFavorite = useCallback(
    async (payload: CreateFavoritePayload): Promise<boolean> => {
      try {
        const res = await favoritesApi.add(payload)
        setFavorites((prev) => [res.favorite, ...prev])
        toast.success(res.message || 'Berhasil ditambahkan ke favorit.')
        return true
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menambahkan favorit.'
        toast.error(msg)
        return false
      }
    },
    [toast]
  )

  const updateFavorite = useCallback(
    async (id: string, payload: UpdateFavoritePayload): Promise<boolean> => {
      try {
        const res = await favoritesApi.update(id, payload)
        setFavorites((prev) =>
          prev.map((item) => (item.id === id ? res.favorite : item))
        )
        toast.success(res.message || 'Catatan favorit berhasil disimpan.')
        return true
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal mengubah favorit.'
        toast.error(msg)
        return false
      }
    },
    [toast]
  )

  const removeFavorite = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await favoritesApi.remove(id)
        setFavorites((prev) => prev.filter((item) => item.id !== id))
        toast.success(res.message || 'Item dihapus dari favorit.')
        return true
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menghapus favorit.'
        toast.error(msg)
        return false
      }
    },
    [toast]
  )

  const isFavorite = useCallback(
    (itemType: FavoriteItemType, targetId: string): boolean => {
      return favorites.some((item) => {
        if (item.itemType !== itemType) return false
        if (itemType === 'service') return item.serviceId === targetId
        return item.providerId === targetId
      })
    },
    [favorites]
  )

  const getFavoriteByTarget = useCallback(
    (itemType: FavoriteItemType, targetId: string): FavoriteItem | undefined => {
      return favorites.find((item) => {
        if (item.itemType !== itemType) return false
        if (itemType === 'service') return item.serviceId === targetId
        return item.providerId === targetId
      })
    },
    [favorites]
  )

  const filteredFavorites = favorites.filter((item) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const matchTitle = item.target.title.toLowerCase().includes(q)
    const matchDesc = item.target.description?.toLowerCase().includes(q) ?? false
    const matchLabel = item.label?.toLowerCase().includes(q) ?? false
    const matchNotes = item.notes?.toLowerCase().includes(q) ?? false
    const matchCategory = item.target.categoryName?.toLowerCase().includes(q) ?? false
    const matchProvider = item.target.providerName?.toLowerCase().includes(q) ?? false

    return (
      matchTitle ||
      matchDesc ||
      matchLabel ||
      matchNotes ||
      matchCategory ||
      matchProvider
    )
  })

  return {
    favorites: filteredFavorites,
    allFavorites: favorites,
    loading,
    error,
    filterType,
    setFilterType,
    searchQuery,
    setSearchQuery,
    refresh: fetchFavorites,
    addFavorite,
    updateFavorite,
    removeFavorite,
    isFavorite,
    getFavoriteByTarget,
  }
}
