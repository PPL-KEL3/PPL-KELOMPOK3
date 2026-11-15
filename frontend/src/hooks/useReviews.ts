'use client'

import { useCallback, useEffect, useState } from 'react'
import { reviewsApi } from '@/lib/api'
import { useAuth } from '@/components/auth/AuthProvider'
import { useToast } from '@/components/ui/ToastProvider'
import type {
  CreateReviewPayload,
  ProviderReviewStats,
  ReviewItem,
  UpdateReviewPayload,
} from '@/types/review'

export function useReviews(providerId?: string) {
  const { user } = useAuth()
  const toast = useToast()

  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [stats, setStats] = useState<ProviderReviewStats | null>(null)
  const [myReviews, setMyReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const loadProviderReviews = useCallback(async (pId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await reviewsApi.getProviderReviews(pId)
      setReviews(res.reviews)
      setStats(res.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat ulasan.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMyReviews = useCallback(async () => {
    if (!user) {
      setMyReviews([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await reviewsApi.getMyReviews()
      setMyReviews(res.reviews)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat ulasan Anda.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (providerId) {
      void loadProviderReviews(providerId)
    } else {
      void loadMyReviews()
    }
  }, [providerId, loadProviderReviews, loadMyReviews])

  const submitReview = useCallback(
    async (payload: CreateReviewPayload): Promise<boolean> => {
      try {
        const res = await reviewsApi.create(payload)
        toast.success(res.message || 'Ulasan berhasil disimpan!')
        if (providerId) {
          void loadProviderReviews(providerId)
        } else {
          void loadMyReviews()
        }
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal mengirim ulasan.')
        return false
      }
    },
    [toast, providerId, loadProviderReviews, loadMyReviews]
  )

  const editReview = useCallback(
    async (id: string, payload: UpdateReviewPayload): Promise<boolean> => {
      try {
        const res = await reviewsApi.update(id, payload)
        toast.success(res.message || 'Ulasan berhasil diperbarui!')
        if (providerId) {
          void loadProviderReviews(providerId)
        } else {
          void loadMyReviews()
        }
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal mengubah ulasan.')
        return false
      }
    },
    [toast, providerId, loadProviderReviews, loadMyReviews]
  )

  const removeReview = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await reviewsApi.remove(id)
        toast.success(res.message || 'Ulasan berhasil ditarik.')
        if (providerId) {
          void loadProviderReviews(providerId)
        } else {
          void loadMyReviews()
        }
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menarik ulasan.')
        return false
      }
    },
    [toast, providerId, loadProviderReviews, loadMyReviews]
  )

  return {
    reviews,
    stats,
    myReviews,
    loading,
    error,
    refreshProvider: () => providerId && loadProviderReviews(providerId),
    refreshMine: loadMyReviews,
    submitReview,
    editReview,
    removeReview,
  }
}
