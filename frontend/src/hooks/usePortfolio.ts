'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiError, portfolioApi } from '@/lib/api'
import {
  hasPortfolioErrors,
  normalizePortfolioTitle,
  validatePortfolioFile,
  validatePortfolioInput,
} from '@/lib/portfolio-utils'
import {
  PORTFOLIO_MAX_ITEMS,
  type PortfolioContentType,
  type PortfolioFormErrors,
  type PortfolioFormInput,
  type PortfolioItem,
} from '@/types/portfolio'

/** `uploadFailed` = file belum terunggah (koneksi/storage), item belum tersimpan. */
export type PortfolioMutationResult =
  | { ok: true; item: PortfolioItem }
  | { ok: false; errors: PortfolioFormErrors; uploadFailed?: boolean }

export type PortfolioDeleteResult =
  | { ok: true; fileCleanupFailed: boolean }
  | { ok: false; message: string }

export const PORTFOLIO_SAVE_ERROR = 'Gagal menyimpan portofolio. Coba lagi.'

interface PortfolioState {
  loaded: boolean
  items: PortfolioItem[]
  error: string | null
}

function toLoadMessage(err: unknown): string {
  return err instanceof ApiError && err.status !== 0 && err.message
    ? err.message
    : 'Gagal memuat galeri.'
}

function toFormErrors(err: unknown): PortfolioFormErrors {
  if (!(err instanceof ApiError)) return { general: PORTFOLIO_SAVE_ERROR }

  const errors: PortfolioFormErrors = {}
  if (err.fields?.title) errors.title = err.fields.title
  if (err.fields?.description) errors.description = err.fields.description
  if (err.fields?.file) errors.file = err.fields.file
  if (
    !errors.file &&
    (err.code === 'INVALID_FILE_TYPE' ||
      err.code === 'FILE_TOO_LARGE' ||
      err.code === 'UPLOAD_NOT_FOUND' ||
      err.code === 'INVALID_IMAGE_PATH')
  ) {
    errors.file = err.message
  }
  if (!hasPortfolioErrors(errors)) {
    errors.general = err.status !== 0 && err.message ? err.message : PORTFOLIO_SAVE_ERROR
  }
  return errors
}

function sortNewestFirst(items: PortfolioItem[]): PortfolioItem[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function usePortfolio() {
  const [state, setState] = useState<PortfolioState>({
    loaded: false,
    items: [],
    error: null,
  })
  const [tick, setTick] = useState(0)
  const [mutating, setMutating] = useState(false)

  useEffect(() => {
    let cancelled = false

    portfolioApi
      .listMine()
      .then((result) => {
        if (!cancelled) {
          setState({ loaded: true, items: sortNewestFirst(result.items), error: null })
        }
      })
      .catch((err) => {
        if (!cancelled) setState({ loaded: true, items: [], error: toLoadMessage(err) })
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  const reload = useCallback(() => {
    setState((current) => ({ ...current, loaded: false }))
    setTick((value) => value + 1)
  }, [])

  /**
   * Alur unggah saat Simpan: minta signed URL -> kirim file langsung ke storage
   * -> kembalikan `imagePath` untuk disimpan. Backend membersihkan file bila simpan gagal.
   */
  async function uploadPhoto(
    file: File,
    onProgress: (percent: number) => void,
    replaceId?: string
  ): Promise<string> {
    const { uploadUrl, imagePath } = await portfolioApi.requestUploadUrl({
      fileName: file.name,
      contentType: file.type as PortfolioContentType,
      size: file.size,
      ...(replaceId ? { purpose: 'replace' as const, portfolioId: replaceId } : {}),
    })
    await portfolioApi.uploadFile(uploadUrl, file, onProgress)
    return imagePath
  }

  function uploadFailure(err: unknown): PortfolioMutationResult | null {
    if (err instanceof ApiError && err.code === 'UPLOAD_FAILED') {
      return { ok: false, uploadFailed: true, errors: { file: err.message } }
    }
    return null
  }

  const createItem = useCallback(
    async (
      input: PortfolioFormInput,
      file: File | null,
      onProgress: (percent: number) => void
    ): Promise<PortfolioMutationResult> => {
      const errors = validatePortfolioInput(input)
      if (!file) errors.file = 'Pilih foto hasil kerja terlebih dahulu.'
      else {
        const fileError = validatePortfolioFile(file)
        if (fileError) errors.file = fileError
      }
      if (hasPortfolioErrors(errors)) return { ok: false, errors }

      setMutating(true)
      try {
        const imagePath = await uploadPhoto(file!, onProgress)
        const result = await portfolioApi.create({
          title: normalizePortfolioTitle(input.title),
          description: input.description.trim() || null,
          imagePath,
        })
        setState((current) => ({
          ...current,
          items: sortNewestFirst([result.item, ...current.items]),
        }))
        return { ok: true, item: result.item }
      } catch (err) {
        if (err instanceof ApiError && err.code === 'PORTFOLIO_LIMIT_REACHED') {
          reload()
        }
        return uploadFailure(err) ?? { ok: false, errors: toFormErrors(err) }
      } finally {
        setMutating(false)
      }
    },
    [reload]
  )

  const updateItem = useCallback(
    async (
      item: PortfolioItem,
      input: PortfolioFormInput,
      file: File | null,
      onProgress: (percent: number) => void
    ): Promise<PortfolioMutationResult> => {
      const errors = validatePortfolioInput(input)
      if (file) {
        const fileError = validatePortfolioFile(file)
        if (fileError) errors.file = fileError
      }
      if (hasPortfolioErrors(errors)) return { ok: false, errors }

      setMutating(true)
      try {
        const imagePath = file ? await uploadPhoto(file, onProgress, item.id) : undefined
        const result = await portfolioApi.update(item.id, {
          title: normalizePortfolioTitle(input.title),
          description: input.description.trim() || null,
          ...(imagePath ? { imagePath } : {}),
        })
        setState((current) => ({
          ...current,
          items: current.items.map((existing) =>
            existing.id === result.item.id ? result.item : existing
          ),
        }))
        return { ok: true, item: result.item }
      } catch (err) {
        return uploadFailure(err) ?? { ok: false, errors: toFormErrors(err) }
      } finally {
        setMutating(false)
      }
    },
    []
  )

  const deleteItem = useCallback(
    async (item: PortfolioItem): Promise<PortfolioDeleteResult> => {
      setMutating(true)
      try {
        const result = await portfolioApi.remove(item.id)
        setState((current) => ({
          ...current,
          items: current.items.filter((existing) => existing.id !== item.id),
        }))
        return { ok: true, fileCleanupFailed: result.fileCleanupFailed }
      } catch (err) {
        return {
          ok: false,
          message:
            err instanceof ApiError && err.status !== 0 && err.message
              ? err.message
              : 'Gagal menghapus portofolio. Coba lagi.',
        }
      } finally {
        setMutating(false)
      }
    },
    []
  )

  const items = state.items
  return {
    items,
    loading: !state.loaded,
    error: state.loaded ? state.error : null,
    reload,
    mutating,
    remainingSlots: Math.max(0, PORTFOLIO_MAX_ITEMS - items.length),
    createItem,
    updateItem,
    deleteItem,
  }
}
