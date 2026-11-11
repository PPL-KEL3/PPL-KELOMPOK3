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
export const MAX_PORTFOLIO_FILE_SIZE = 5 * 1024 * 1024

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
  /**
   * `replace` = ganti foto item yang sudah ada, tidak dicek batas 20 item.
   * Wajib disertai `portfolioId` milik penyedia itu sendiri.
   */
  purpose: 'create' | 'replace'
  portfolioId?: string
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

  if (code === '23505') {
    return new AppError(400, 'INVALID_IMAGE_PATH', 'Lokasi foto tidak valid. Unggah ulang fotonya.')
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

// ---------------------------------------------------------------------------
// Validasi file, path, batas, dan kepemilikan (TPR-47)
// ---------------------------------------------------------------------------

function limitReached(): AppError {
  return new AppError(
    409,
    'PORTFOLIO_LIMIT_REACHED',
    `Maksimal ${MAX_PORTFOLIO_ITEMS} item portofolio. Hapus item lama untuk menambah yang baru.`
  )
}

function invalidImagePath(): AppError {
  return new AppError(400, 'INVALID_IMAGE_PATH', 'Lokasi foto tidak valid. Unggah ulang fotonya.')
}

function assertProviderCanAdd(rows: PortfolioRow[]): void {
  if (rows.length >= MAX_PORTFOLIO_ITEMS) throw limitReached()
}

const IMAGE_PATH_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$/

/**
 * Path dari klien tidak dipercaya: harus `{providerId}/{uuid}.jpg|png`, persis format
 * yang dibuat `createUploadUrl`, sehingga tidak bisa menunjuk folder penyedia lain.
 */
export function isOwnImagePath(imagePath: string, providerId: string): boolean {
  const match = IMAGE_PATH_PATTERN.exec(imagePath)
  return match !== null && match[1] === providerId.toLowerCase()
}

type FileLookup = { data: StoredFileInfo | null; error: DatabaseErrorLike | null }

function lookupUploadedFile(imagePath: string, accessToken: string): Promise<FileLookup> {
  return activePortfolioStore.findFile(imagePath, accessToken)
}

/**
 * Memastikan file hasil unggah benar-benar ada di bucket dan sesuai batas.
 * (File yang melanggar dihapus oleh pemanggil lewat `discardUploadedFile`.)
 */
function checkUploadedFile({ data, error }: FileLookup): void {
  if (error) {
    console.error('[portfolio] File lookup failed', { code: error.code ?? 'unknown' })
    throw new AppError(
      502,
      'PORTFOLIO_SERVICE_ERROR',
      'Foto belum bisa diperiksa. Silakan coba lagi.'
    )
  }
  if (!data) {
    throw new AppError(
      400,
      'UPLOAD_NOT_FOUND',
      'Foto belum terunggah. Pilih foto lalu simpan lagi.'
    )
  }

  if (data.size !== null && data.size > MAX_PORTFOLIO_FILE_SIZE) {
    throw new AppError(400, 'FILE_TOO_LARGE', 'Ukuran foto maksimal 5 MB.')
  }
  if (data.contentType !== null && !(data.contentType in EXTENSION_BY_CONTENT_TYPE)) {
    throw new AppError(400, 'INVALID_FILE_TYPE', 'Format foto harus JPG atau PNG.')
  }
}

/**
 * Menghapus file baru yang sudah terunggah tapi gagal disimpan. Hanya untuk path
 * milik penyedia itu sendiri yang belum dipakai item mana pun.
 */
export async function discardUploadedFile(
  imagePath: string | undefined,
  providerId: string,
  accessToken: string,
  knownRows?: PortfolioRow[]
): Promise<void> {
  if (!imagePath || !isOwnImagePath(imagePath, providerId)) return
  try {
    const rows = knownRows ?? (await loadProviderRows(providerId, accessToken))
    if (rows.some((row) => row.image_path === imagePath)) return
    await removeFilesQuietly([imagePath], accessToken, 'discard_unsaved_upload')
  } catch {
    console.error('[portfolio] File cleanup failed', {
      action: 'discard_unsaved_upload',
      code: 'exception',
    })
  }
}

async function loadOwnedItem(
  id: string,
  providerId: string,
  accessToken: string
): Promise<PortfolioRow> {
  const { data, error } = await activePortfolioStore.findById(id, accessToken)
  if (error) throw mapPortfolioDatabaseError('find', error)
  if (!data) throw portfolioNotFound()
  if (data.provider_id !== providerId) {
    throw new AppError(
      403,
      'PORTFOLIO_OWNERSHIP_FORBIDDEN',
      'Kamu tidak memiliki izin untuk mengelola portofolio milik penyedia lain.'
    )
  }
  return data
}

// ---------------------------------------------------------------------------
// Operasi
// ---------------------------------------------------------------------------

export async function createUploadUrl(
  input: UploadUrlInput,
  providerId: string,
  accessToken: string
): Promise<{ uploadUrl: string; imagePath: string }> {
  const extension = EXTENSION_BY_CONTENT_TYPE[input.contentType]
  if (!extension) {
    throw new AppError(400, 'INVALID_FILE_TYPE', 'Format foto harus JPG atau PNG.')
  }
  if (input.size > MAX_PORTFOLIO_FILE_SIZE) {
    throw new AppError(400, 'FILE_TOO_LARGE', 'Ukuran foto maksimal 5 MB.')
  }
  if (input.purpose === 'replace' && !input.portfolioId) throw portfolioNotFound()

  // Nama file dibuat ulang dengan UUID; nama asli tidak dipakai di path.
  const imagePath = `${providerId}/${randomUUID()}.${extension}`

  // Pengecekan izin dan pembuatan URL berjalan paralel (keduanya hanya baca/tanda tangan),
  // tapi URL baru dikembalikan setelah pengecekan lolos:
  // - tambah item baru ditolak bila sudah 20 item;
  // - ganti foto tidak menambah item, tapi hanya untuk item yang ada dan milik sendiri
  //   (404/403), supaya `replace` tidak bisa dipakai melewati batas 20.
  const permission =
    input.purpose === 'replace'
      ? loadOwnedItem(input.portfolioId!, providerId, accessToken).then(() => undefined)
      : loadProviderRows(providerId, accessToken).then(assertProviderCanAdd)
  const [permissionResult, signed] = await Promise.allSettled([
    permission,
    activePortfolioStore.createSignedUploadUrl(imagePath, accessToken),
  ])

  if (permissionResult.status === 'rejected') throw permissionResult.reason
  const { data, error } =
    signed.status === 'fulfilled'
      ? signed.value
      : { data: null, error: { code: 'exception' } as DatabaseErrorLike }
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
  if (!isOwnImagePath(input.imagePath, providerId)) throw invalidImagePath()

  // Daftar item dan info file dibaca paralel; keputusan tetap diambil berurutan di bawah.
  const [rows, fileLookup] = await Promise.all([
    loadProviderRows(providerId, accessToken),
    lookupUploadedFile(input.imagePath, accessToken),
  ])
  // Path yang sudah dipakai item lain tidak boleh dipakai ulang (dan file-nya tidak boleh dihapus).
  if (rows.some((row) => row.image_path === input.imagePath)) throw invalidImagePath()

  try {
    assertProviderCanAdd(rows)
    checkUploadedFile(fileLookup)

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
  } catch (error) {
    // Simpan gagal setelah file terunggah: hapus file baru supaya tidak yatim.
    // Daftar item dimuat ulang, supaya file milik item lain tidak ikut terhapus.
    await discardUploadedFile(input.imagePath, providerId, accessToken)
    throw error
  }
}

export async function updatePortfolioItem(
  id: string,
  input: UpdatePortfolioInput,
  providerId: string,
  accessToken: string
): Promise<PortfolioDto> {
  const newPath = input.imagePath
  const checkNewPath = newPath !== undefined && isOwnImagePath(newPath, providerId)

  // Item, daftar item, dan info file baru dibaca paralel. Hasil kepemilikan tetap
  // dievaluasi lebih dulu (404/403), baru path dan file.
  const [owned, rowsResult, fileResult] = await Promise.allSettled([
    loadOwnedItem(id, providerId, accessToken),
    checkNewPath ? loadProviderRows(providerId, accessToken) : Promise.resolve(undefined),
    checkNewPath ? lookupUploadedFile(newPath!, accessToken) : Promise.resolve(undefined),
  ])
  if (owned.status === 'rejected') throw owned.reason
  const current = owned.value

  const oldPath = current.image_path
  const replacingPhoto = newPath !== undefined && newPath !== oldPath
  const payload: UpdatePortfolioInput = { ...input }
  if (!replacingPhoto) delete payload.imagePath

  if (replacingPhoto) {
    if (!checkNewPath) throw invalidImagePath()
    if (rowsResult.status === 'rejected') throw rowsResult.reason
    if (rowsResult.value!.some((row) => row.image_path === newPath)) throw invalidImagePath()
  }

  if (Object.keys(payload).length === 0) return toDto(current)

  try {
    if (replacingPhoto) {
      if (fileResult.status === 'rejected') throw fileResult.reason
      checkUploadedFile(fileResult.value!)
    }

    const { data, error } = await activePortfolioStore.updateById(id, payload, accessToken)
    if (error) throw mapPortfolioDatabaseError('update', error)
    if (!data) throw portfolioNotFound()

    // Foto lama dihapus hanya setelah data baru tersimpan. Gagal hapus tidak menggagalkan respons.
    if (replacingPhoto) {
      await removeFilesQuietly([oldPath], accessToken, 'replace_old_file')
    }
    return toDto(data)
  } catch (error) {
    if (replacingPhoto) {
      await discardUploadedFile(newPath, providerId, accessToken)
    }
    throw error
  }
}

export async function deletePortfolioItem(
  id: string,
  providerId: string,
  accessToken: string
): Promise<{ item: PortfolioDto; fileCleanupFailed: boolean }> {
  // Langsung hapus: RLS hanya mengizinkan baris milik sendiri. Kalau tidak ada baris yang
  // terhapus, baru dicek apakah item tidak ada (404) atau milik penyedia lain (403).
  const { data, error } = await activePortfolioStore.deleteById(id, accessToken)
  if (error) throw mapPortfolioDatabaseError('delete', error)
  if (!data) {
    await loadOwnedItem(id, providerId, accessToken)
    throw portfolioNotFound()
  }
  if (data.provider_id !== providerId) {
    // Tidak seharusnya terjadi (RLS), tapi jangan pernah menghapus file folder lain.
    console.error('[portfolio] Deleted row owner mismatch', { action: 'delete' })
    throw new AppError(
      403,
      'PORTFOLIO_OWNERSHIP_FORBIDDEN',
      'Kamu tidak memiliki izin untuk mengelola portofolio milik penyedia lain.'
    )
  }

  // Baris sudah terhapus; file dihapus sesudahnya. Kalau gagal, data tetap terhapus
  // dan respons memberi tahu bahwa file masih tertinggal.
  const fileRemoved = await removeFilesQuietly([data.image_path], accessToken, 'delete_file')
  return { item: toDto(data), fileCleanupFailed: !fileRemoved }
}
