import { createSupabaseClient, supabaseConfigured } from '../config/supabase'
import { AppError } from '../lib/errors'

export interface CategoryDto {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface CategoryRow {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface CreateCategoryInput {
  name: string
  description: string | null
}

export interface UpdateCategoryInput {
  name?: string
  description?: string | null
}

export interface DatabaseErrorLike {
  code?: string
  message?: string
  details?: string | null
}

export interface CategoryStore {
  findAll(): Promise<{ data: CategoryRow[] | null; error: DatabaseErrorLike | null }>
  findById(
    id: string
  ): Promise<{ data: CategoryRow | null; error: DatabaseErrorLike | null }>
  insert(
    input: CreateCategoryInput,
    accessToken: string
  ): Promise<{ data: CategoryRow | null; error: DatabaseErrorLike | null }>
  updateById(
    id: string,
    input: UpdateCategoryInput,
    accessToken: string
  ): Promise<{ data: CategoryRow | null; error: DatabaseErrorLike | null }>
  deleteById(
    id: string,
    accessToken: string
  ): Promise<{ data: CategoryRow | null; error: DatabaseErrorLike | null }>
}

const CATEGORY_COLUMNS = 'id, name, description, created_at, updated_at'

function ensureSupabaseConfigured(): void {
  if (!supabaseConfigured) {
    throw new AppError(
      503,
      'CATEGORY_SERVICE_UNAVAILABLE',
      'Layanan database kategori belum dikonfigurasi. Hubungi administrator LOKA.'
    )
  }
}

export function mapCategoryRow(row: CategoryRow): CategoryDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function logDatabaseError(action: string, error: DatabaseErrorLike): void {
  console.error('[category] Database error', {
    action,
    code: error.code ?? 'unknown',
  })
}

export function mapCategoryDatabaseError(
  action: string,
  error: DatabaseErrorLike
): AppError {
  const code = error.code ?? ''

  if (code === '23505') {
    return new AppError(
      409,
      'CATEGORY_NAME_EXISTS',
      'Nama kategori sudah digunakan. Gunakan nama kategori yang berbeda.',
      {
        name: 'Nama kategori sudah digunakan. Gunakan nama kategori yang berbeda.',
      }
    )
  }

  if (code === '23503') {
    return new AppError(
      409,
      'CATEGORY_IN_USE',
      'Kategori tidak dapat dihapus karena masih terhubung dengan layanan jasa.'
    )
  }

  if (code === '22P02') {
    return new AppError(400, 'INVALID_CATEGORY_ID', 'Format ID kategori tidak valid.')
  }

  if (code === '42501') {
    return new AppError(
      403,
      'FORBIDDEN',
      'Hanya administrator LOKA yang dapat mengelola kategori jasa.'
    )
  }

  if (code === '42P01' || code === 'PGRST205') {
    logDatabaseError(action, error)
    return new AppError(
      503,
      'CATEGORY_TABLE_UNAVAILABLE',
      'Tabel kategori belum tersedia pada database. Hubungi administrator LOKA.'
    )
  }

  logDatabaseError(action, error)
  return new AppError(
    502,
    'CATEGORY_SERVICE_ERROR',
    'Layanan kategori sedang bermasalah. Silakan coba lagi.'
  )
}

const supabaseCategoryStore: CategoryStore = {
  async findAll() {
    ensureSupabaseConfigured()
    const client = createSupabaseClient()
    const { data, error } = await client
      .from('categories')
      .select(CATEGORY_COLUMNS)
      .order('created_at', { ascending: true })
      .order('name', { ascending: true })

    return {
      data: (data as CategoryRow[] | null) ?? null,
      error,
    }
  },

  async findById(id: string) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient()
    const { data, error } = await client
      .from('categories')
      .select(CATEGORY_COLUMNS)
      .eq('id', id)
      .maybeSingle()

    return {
      data: (data as CategoryRow | null) ?? null,
      error,
    }
  },

  async insert(input: CreateCategoryInput, accessToken: string) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('categories')
      .insert({
        name: input.name,
        description: input.description,
      })
      .select(CATEGORY_COLUMNS)
      .single()

    return {
      data: (data as CategoryRow | null) ?? null,
      error,
    }
  },

  async updateById(id: string, input: UpdateCategoryInput, accessToken: string) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient(accessToken)

    const payload: Record<string, unknown> = {}
    if (input.name !== undefined) payload.name = input.name
    if (input.description !== undefined) payload.description = input.description

    const { data, error } = await client
      .from('categories')
      .update(payload)
      .eq('id', id)
      .select(CATEGORY_COLUMNS)
      .maybeSingle()

    return {
      data: (data as CategoryRow | null) ?? null,
      error,
    }
  },

  async deleteById(id: string, accessToken: string) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('categories')
      .delete()
      .eq('id', id)
      .select(CATEGORY_COLUMNS)
      .maybeSingle()

    return {
      data: (data as CategoryRow | null) ?? null,
      error,
    }
  },
}

let activeCategoryStore: CategoryStore = supabaseCategoryStore

/**
 * Digunakan khusus pada pengujian unit/mock agar endpoint dapat diuji
 * tanpa memodifikasi database Supabase bersama.
 */
export function setCategoryStoreForTesting(store: CategoryStore | null): void {
  activeCategoryStore = store ?? supabaseCategoryStore
}

export async function listCategories(): Promise<CategoryDto[]> {
  const { data, error } = await activeCategoryStore.findAll()

  if (error) {
    throw mapCategoryDatabaseError('list', error)
  }

  return (data ?? []).map(mapCategoryRow)
}

export async function getCategoryById(id: string): Promise<CategoryDto> {
  const { data, error } = await activeCategoryStore.findById(id)

  if (error) {
    throw mapCategoryDatabaseError('detail', error)
  }

  if (!data) {
    throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Kategori jasa tidak ditemukan.')
  }

  return mapCategoryRow(data)
}

export async function createCategory(
  input: CreateCategoryInput,
  accessToken: string
): Promise<CategoryDto> {
  const { data, error } = await activeCategoryStore.insert(input, accessToken)

  if (error) {
    throw mapCategoryDatabaseError('create', error)
  }

  if (!data) {
    throw new AppError(
      502,
      'CATEGORY_SERVICE_ERROR',
      'Kategori baru gagal disimpan. Silakan coba lagi.'
    )
  }

  return mapCategoryRow(data)
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
  accessToken: string
): Promise<CategoryDto> {
  const { data, error } = await activeCategoryStore.updateById(
    id,
    input,
    accessToken
  )

  if (error) {
    throw mapCategoryDatabaseError('update', error)
  }

  if (!data) {
    throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Kategori jasa tidak ditemukan.')
  }

  return mapCategoryRow(data)
}

export async function deleteCategory(
  id: string,
  accessToken: string
): Promise<CategoryDto> {
  const { data, error } = await activeCategoryStore.deleteById(id, accessToken)

  if (error) {
    throw mapCategoryDatabaseError('delete', error)
  }

  if (!data) {
    throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Kategori jasa tidak ditemukan.')
  }

  return mapCategoryRow(data)
}

