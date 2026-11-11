import { randomUUID } from 'node:crypto'
import {
  createSupabaseClient,
  getSupabaseEnv,
  supabaseConfigured,
} from '../config/supabase'
import { AppError } from '../lib/errors'
import type { DatabaseErrorLike } from './category.service'

export const PORTFOLIO_BUCKET = 'portfolio'
export const MAX_PORTFOLIO_ITEMS = 20

export interface PortfolioDto {
  id: string
  providerId: string
  title: string
  description: string | null
  imageUrl: string
  imagePath: string
  createdAt: string
  updatedAt: string
}

export interface PortfolioRow {
  id: string
  provider_id: string
  title: string
  description: string | null
  image_path: string
  created_at: string
  updated_at: string
}

export interface CreatePortfolioInput {
  title: string
  description: string | null
  imagePath: string
}

export interface UpdatePortfolioInput {
  title?: string
  description?: string | null
  imagePath?: string
}

export interface UploadUrlInput {
  fileName: string
  contentType: string
  size: number
}

export interface StoredFileInfo {
  size: number | null
  contentType: string | null
}

type StoreResult<T> = Promise<{ data: T; error: DatabaseErrorLike | null }>

/**
 * Semua akses database dan storage lewat store ini supaya bisa di-mock di tes.
 * Operasi tulis memakai token pengguna, jadi RLS dan storage policy tetap berlaku.
 */
export interface PortfolioStore {
  isPublicProvider(providerId: string): StoreResult<boolean | null>
  findPublicByProviderId(providerId: string): StoreResult<PortfolioRow[] | null>
  findByProviderId(providerId: string, accessToken: string): StoreResult<PortfolioRow[] | null>
  findById(id: string, accessToken: string): StoreResult<PortfolioRow | null>
  insert(
    providerId: string,
    input: CreatePortfolioInput,
    accessToken: string
  ): StoreResult<PortfolioRow | null>
  updateById(
    id: string,
    input: UpdatePortfolioInput,
    accessToken: string
  ): StoreResult<PortfolioRow | null>
  deleteById(id: string, accessToken: string): StoreResult<PortfolioRow | null>
  createSignedUploadUrl(path: string, accessToken: string): StoreResult<string | null>
  findFile(path: string, accessToken: string): StoreResult<StoredFileInfo | null>
  /** Mengembalikan path yang benar-benar terhapus (kosong bila ditolak policy). */
  removeFiles(paths: string[], accessToken: string): StoreResult<string[] | null>
  publicUrl(path: string): string
}

const PORTFOLIO_COLUMNS =
  'id, provider_id, title, description, image_path, created_at, updated_at'

const EXTENSION_BY_CONTENT_TYPE: Record<string, 'jpg' | 'png'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

function ensureSupabaseConfigured(): void {
  if (!supabaseConfigured) {
    throw new AppError(
      503,
      'PORTFOLIO_SERVICE_UNAVAILABLE',
      'Layanan portofolio belum dikonfigurasi. Hubungi administrator LOKA.'
    )
  }
}

function storageError(error: { message?: string; statusCode?: string } | null) {
  if (!error) return null
  return {
    code: `STORAGE_${error.statusCode ?? 'ERROR'}`,
    message: error.message,
  }
}

export function mapPortfolioRow(row: PortfolioRow, publicUrl: (path: string) => string): PortfolioDto {
  return {
    id: row.id,
    providerId: row.provider_id,
    title: row.title,
    description: row.description,
    imageUrl: publicUrl(row.image_path),
    imagePath: row.image_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapPortfolioDatabaseError(
  action: string,
  error: DatabaseErrorLike
): AppError {
  const code = error.code ?? ''

  if (code === '23514') {
    return new AppError(400, 'VALIDATION_ERROR', 'Data portofolio tidak valid.')
  }

  if (code === '22P02') {
    return new AppError(404, 'PORTFOLIO_NOT_FOUND', 'Portofolio tidak ditemukan.')
  }

  if (code === '42501') {
    return new AppError(
      403,
      'PORTFOLIO_OWNERSHIP_FORBIDDEN',
      'Kamu tidak memiliki izin untuk mengelola portofolio ini.'
    )
  }

  console.error('[portfolio] Database error', { action, code: code || 'unknown' })

  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202') {
    return new AppError(
      503,
      'PORTFOLIO_TABLE_UNAVAILABLE',
      'Tabel portofolio belum tersedia pada database. Hubungi administrator LOKA.'
    )
  }

  return new AppError(
    502,
    'PORTFOLIO_SERVICE_ERROR',
    'Layanan portofolio sedang bermasalah. Silakan coba lagi.'
  )
}

const supabasePortfolioStore: PortfolioStore = {
  async isPublicProvider(providerId) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient().rpc('is_public_provider', {
      p_provider_id: providerId,
    })
    return { data: typeof data === 'boolean' ? data : null, error }
  },

  async findPublicByProviderId(providerId) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient()
      .from('provider_portfolios')
      .select(PORTFOLIO_COLUMNS)
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
    return { data: (data as PortfolioRow[] | null) ?? null, error }
  },

  async findByProviderId(providerId, accessToken) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient(accessToken)
      .from('provider_portfolios')
      .select(PORTFOLIO_COLUMNS)
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
    return { data: (data as PortfolioRow[] | null) ?? null, error }
  },

  async findById(id, accessToken) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient(accessToken)
      .from('provider_portfolios')
      .select(PORTFOLIO_COLUMNS)
      .eq('id', id)
      .maybeSingle()
    return { data: (data as PortfolioRow | null) ?? null, error }
  },

  async insert(providerId, input, accessToken) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient(accessToken)
      .from('provider_portfolios')
      .insert({
        provider_id: providerId,
        title: input.title,
        description: input.description,
        image_path: input.imagePath,
      })
      .select(PORTFOLIO_COLUMNS)
      .single()
    return { data: (data as PortfolioRow | null) ?? null, error }
  },

  async updateById(id, input, accessToken) {
    ensureSupabaseConfigured()
    const payload: Record<string, unknown> = {}
    if (input.title !== undefined) payload.title = input.title
    if (input.description !== undefined) payload.description = input.description
    if (input.imagePath !== undefined) payload.image_path = input.imagePath

    const { data, error } = await createSupabaseClient(accessToken)
      .from('provider_portfolios')
      .update(payload)
      .eq('id', id)
      .select(PORTFOLIO_COLUMNS)
      .maybeSingle()
    return { data: (data as PortfolioRow | null) ?? null, error }
  },

  async deleteById(id, accessToken) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient(accessToken)
      .from('provider_portfolios')
      .delete()
      .eq('id', id)
      .select(PORTFOLIO_COLUMNS)
      .maybeSingle()
    return { data: (data as PortfolioRow | null) ?? null, error }
  },

  async createSignedUploadUrl(path, accessToken) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient(accessToken)
      .storage.from(PORTFOLIO_BUCKET)
      .createSignedUploadUrl(path)
    return { data: data?.signedUrl ?? null, error: storageError(error) }
  },

  async findFile(path, accessToken) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient(accessToken)
      .storage.from(PORTFOLIO_BUCKET)
      .info(path)
    if (error) {
      // 404/400 dari storage = file tidak ada (atau tidak terlihat oleh pengguna ini).
      const status = (error as { statusCode?: string; status?: number }).statusCode
        ?? String((error as { status?: number }).status ?? '')
      if (status === '404' || status === '400') return { data: null, error: null }
      return { data: null, error: storageError(error) }
    }
    return {
      data: {
        size: typeof data?.size === 'number' ? data.size : null,
        contentType: data?.contentType ?? null,
      },
      error: null,
    }
  },

  async removeFiles(paths, accessToken) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient(accessToken)
      .storage.from(PORTFOLIO_BUCKET)
      .remove(paths)
    return {
      data: data ? data.map((file) => file.name) : null,
      error: storageError(error),
    }
  },

  publicUrl(path) {
    const { url } = getSupabaseEnv()
    const encoded = path.split('/').map(encodeURIComponent).join('/')
    return `${url}/storage/v1/object/public/${PORTFOLIO_BUCKET}/${encoded}`
  },
}

let activePortfolioStore: PortfolioStore = supabasePortfolioStore

export function setPortfolioStoreForTesting(store: PortfolioStore | null): void {
  activePortfolioStore = store ?? supabasePortfolioStore
}

function toDto(row: PortfolioRow): PortfolioDto {
  return mapPortfolioRow(row, (path) => activePortfolioStore.publicUrl(path))
}

function portfolioNotFound(): AppError {
  return new AppError(404, 'PORTFOLIO_NOT_FOUND', 'Portofolio tidak ditemukan.')
}

async function removeFilesQuietly(
  paths: string[],
  accessToken: string,
  action: string
): Promise<boolean> {
  try {
    const { data, error } = await activePortfolioStore.removeFiles(paths, accessToken)
    const removed = data ?? []
    const ok = !error && paths.every((path) => removed.some((name) => path.endsWith(name)))
    if (!ok) {
      console.error('[portfolio] File cleanup failed', {
        action,
        code: error?.code ?? 'not_removed',
      })
    }
    return ok
  } catch {
    console.error('[portfolio] File cleanup failed', { action, code: 'exception' })
    return false
  }
}

export async function listPublicPortfolio(providerId: string): Promise<PortfolioDto[]> {
  const provider = await activePortfolioStore.isPublicProvider(providerId)
  if (provider.error) throw mapPortfolioDatabaseError('check_provider', provider.error)
  if (!provider.data) {
    throw new AppError(404, 'PROVIDER_NOT_FOUND', 'Penyedia jasa tidak ditemukan.')
  }

  const { data, error } = await activePortfolioStore.findPublicByProviderId(providerId)
  if (error) throw mapPortfolioDatabaseError('list_public', error)
  return (data ?? []).map(toDto)
}

async function loadProviderRows(providerId: string, accessToken: string): Promise<PortfolioRow[]> {
  const { data, error } = await activePortfolioStore.findByProviderId(providerId, accessToken)
  if (error) throw mapPortfolioDatabaseError('list_provider', error)
  return data ?? []
}

export interface ProviderPortfolioResult {
  items: PortfolioDto[]
  total: number
  limit: number
  remainingSlots: number
}

export async function listProviderPortfolio(
  providerId: string,
  accessToken: string
): Promise<ProviderPortfolioResult> {
  const rows = await loadProviderRows(providerId, accessToken)
  return {
    items: rows.map(toDto),
    total: rows.length,
    limit: MAX_PORTFOLIO_ITEMS,
    remainingSlots: Math.max(0, MAX_PORTFOLIO_ITEMS - rows.length),
  }
}

export async function createUploadUrl(
  input: UploadUrlInput,
  providerId: string,
  accessToken: string
): Promise<{ uploadUrl: string; imagePath: string }> {
  const extension = EXTENSION_BY_CONTENT_TYPE[input.contentType]
  if (!extension) {
    throw new AppError(400, 'INVALID_FILE_TYPE', 'Format foto harus JPG atau PNG.')
  }

  // Nama file dibuat ulang dengan UUID; nama asli tidak dipakai di path.
  const imagePath = `${providerId}/${randomUUID()}.${extension}`
  const { data, error } = await activePortfolioStore.createSignedUploadUrl(
    imagePath,
    accessToken
  )
  if (error || !data) {
    console.error('[portfolio] Signed upload URL failed', { code: error?.code ?? 'empty' })
    throw new AppError(
      502,
      'PORTFOLIO_SERVICE_ERROR',
      'Tautan unggah foto gagal dibuat. Silakan coba lagi.'
    )
  }

  return { uploadUrl: data, imagePath }
}

export async function createPortfolioItem(
  input: CreatePortfolioInput,
  providerId: string,
  accessToken: string
): Promise<PortfolioDto> {
  const { data, error } = await activePortfolioStore.insert(providerId, input, accessToken)
  if (error) throw mapPortfolioDatabaseError('create', error)
  if (!data) {
    throw new AppError(
      502,
      'PORTFOLIO_SERVICE_ERROR',
      'Portofolio baru gagal disimpan. Silakan coba lagi.'
    )
  }
  return toDto(data)
}

export async function updatePortfolioItem(
  id: string,
  input: UpdatePortfolioInput,
  providerId: string,
  accessToken: string
): Promise<PortfolioDto> {
  const current = await activePortfolioStore.findById(id, accessToken)
  if (current.error) throw mapPortfolioDatabaseError('find', current.error)
  if (!current.data || current.data.provider_id !== providerId) throw portfolioNotFound()

  const { data, error } = await activePortfolioStore.updateById(id, input, accessToken)
  if (error) throw mapPortfolioDatabaseError('update', error)
  if (!data) throw portfolioNotFound()

  // Foto lama dihapus hanya setelah data baru tersimpan. Gagal hapus tidak menggagalkan respons.
  const oldPath = current.data.image_path
  if (input.imagePath !== undefined && input.imagePath !== oldPath) {
    await removeFilesQuietly([oldPath], accessToken, 'replace_old_file')
  }

  return toDto(data)
}

export async function deletePortfolioItem(
  id: string,
  providerId: string,
  accessToken: string
): Promise<{ item: PortfolioDto; fileCleanupFailed: boolean }> {
  const current = await activePortfolioStore.findById(id, accessToken)
  if (current.error) throw mapPortfolioDatabaseError('find', current.error)
  if (!current.data || current.data.provider_id !== providerId) throw portfolioNotFound()

  const { data, error } = await activePortfolioStore.deleteById(id, accessToken)
  if (error) throw mapPortfolioDatabaseError('delete', error)
  if (!data) throw portfolioNotFound()

  // Baris sudah terhapus; file dihapus sesudahnya. Kalau gagal, data tetap terhapus.
  const fileRemoved = await removeFilesQuietly([data.image_path], accessToken, 'delete_file')
  return { item: toDto(data), fileCleanupFailed: !fileRemoved }
}
