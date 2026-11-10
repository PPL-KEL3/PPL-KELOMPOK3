import { createSupabaseClient, supabaseConfigured } from '../config/supabase'
import { AppError } from '../lib/errors'
import type { DatabaseErrorLike } from './category.service'

export interface ServiceListingDto {
  id: string
  providerId: string
  providerName: string
  categoryId: string
  categoryName: string
  name: string
  description: string
  price: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ServiceListingRow {
  id: string
  provider_id: string
  provider_name?: string | null
  category_id: string
  category_name?: string | null
  name: string
  description: string
  price: number
  is_active: boolean
  created_at: string
  updated_at: string
  categories?: { name?: string | null } | Array<{ name?: string | null }> | null
  profiles?:
    | { full_name?: string | null }
    | Array<{ full_name?: string | null }>
    | null
}

export interface CreateServiceListingInput {
  categoryId: string
  name: string
  description: string
  price: number
  isActive?: boolean
}

export interface UpdateServiceListingInput {
  categoryId?: string
  name?: string
  description?: string
  price?: number
  isActive?: boolean
}

export interface ServiceListingStore {
  categoryExists(categoryId: string): Promise<{
    exists: boolean
    error: DatabaseErrorLike | null
  }>
  findPublic(filter?: {
    categoryId?: string
  }): Promise<{
    data: ServiceListingRow[] | null
    error: DatabaseErrorLike | null
  }>
  findByProviderId(
    providerId: string,
    accessToken: string
  ): Promise<{
    data: ServiceListingRow[] | null
    error: DatabaseErrorLike | null
  }>
  findById(
    id: string,
    accessToken?: string
  ): Promise<{
    data: ServiceListingRow | null
    error: DatabaseErrorLike | null
  }>
  insert(
    providerId: string,
    providerName: string,
    input: CreateServiceListingInput,
    accessToken: string
  ): Promise<{
    data: ServiceListingRow | null
    error: DatabaseErrorLike | null
  }>
  updateById(
    id: string,
    input: UpdateServiceListingInput,
    accessToken: string
  ): Promise<{
    data: ServiceListingRow | null
    error: DatabaseErrorLike | null
  }>
  deleteById(
    id: string,
    accessToken: string
  ): Promise<{
    data: ServiceListingRow | null
    error: DatabaseErrorLike | null
  }>
}

const SERVICE_SELECT_COLUMNS =
  'id, provider_id, category_id, name, description, price, is_active, created_at, updated_at, categories(name), profiles!services_provider_id_fkey(full_name)'

function ensureSupabaseConfigured(): void {
  if (!supabaseConfigured) {
    throw new AppError(
      503,
      'SERVICE_LISTING_UNAVAILABLE',
      'Layanan database katalog jasa belum dikonfigurasi. Hubungi administrator LOKA.'
    )
  }
}

function resolveJoinedCategoryName(row: ServiceListingRow): string {
  if (row.category_name && row.category_name.trim()) {
    return row.category_name.trim()
  }

  const joined = row.categories
  if (Array.isArray(joined)) {
    const first = joined[0]?.name
    if (first && first.trim()) return first.trim()
  } else if (joined && typeof joined === 'object' && joined.name?.trim()) {
    return joined.name.trim()
  }

  return 'Kategori Jasa'
}

function resolveJoinedProviderName(row: ServiceListingRow): string {
  if (row.provider_name && row.provider_name.trim()) {
    return row.provider_name.trim()
  }

  const joined = row.profiles
  if (Array.isArray(joined)) {
    const first = joined[0]?.full_name
    if (first && first.trim()) return first.trim()
  } else if (joined && typeof joined === 'object' && joined.full_name?.trim()) {
    return joined.full_name.trim()
  }

  return 'Penyedia Jasa LOKA'
}

export function mapServiceListingRow(row: ServiceListingRow): ServiceListingDto {
  return {
    id: row.id,
    providerId: row.provider_id,
    providerName: resolveJoinedProviderName(row),
    categoryId: row.category_id,
    categoryName: resolveJoinedCategoryName(row),
    name: row.name,
    description: row.description,
    price: Number(row.price),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function logServiceDatabaseError(action: string, error: DatabaseErrorLike): void {
  console.error('[service-listing] Database error', {
    action,
    code: error.code ?? 'unknown',
  })
}

export function mapServiceListingDatabaseError(
  action: string,
  error: DatabaseErrorLike
): AppError {
  const code = error.code ?? ''

  if (code === '23503') {
    return new AppError(
      400,
      'INVALID_CATEGORY_REFERENCE',
      'Kategori jasa yang dipilih tidak ditemukan pada sistem.',
      {
        categoryId: 'Kategori jasa yang dipilih tidak ditemukan pada sistem.',
      }
    )
  }

  if (code === '22P02') {
    return new AppError(400, 'INVALID_SERVICE_ID', 'Format ID layanan tidak valid.')
  }

  if (code === '42501') {
    return new AppError(
      403,
      'FORBIDDEN',
      'Kamu tidak memiliki izin untuk mengelola layanan jasa ini.'
    )
  }

  if (code === '42P01' || code === 'PGRST205') {
    logServiceDatabaseError(action, error)
    return new AppError(
      503,
      'SERVICE_TABLE_UNAVAILABLE',
      'Tabel layanan jasa belum tersedia pada database. Hubungi administrator LOKA.'
    )
  }

  logServiceDatabaseError(action, error)
  return new AppError(
    502,
    'SERVICE_LISTING_ERROR',
    'Layanan katalog jasa sedang bermasalah. Silakan coba lagi.'
  )
}

const supabaseServiceListingStore: ServiceListingStore = {
  async categoryExists(categoryId: string) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient()
    const { data, error } = await client
      .from('categories')
      .select('id')
      .eq('id', categoryId)
      .maybeSingle()

    return {
      exists: Boolean(data?.id),
      error,
    }
  },

  async findPublic(filter) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient()
    let query = client
      .from('services')
      .select(SERVICE_SELECT_COLUMNS)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (filter?.categoryId) {
      query = query.eq('category_id', filter.categoryId)
    }

    const { data, error } = await query
    return {
      data: (data as ServiceListingRow[] | null) ?? null,
      error,
    }
  },

  async findByProviderId(providerId: string, accessToken: string) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('services')
      .select(SERVICE_SELECT_COLUMNS)
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })

    return {
      data: (data as ServiceListingRow[] | null) ?? null,
      error,
    }
  },

  async findById(id: string, accessToken?: string) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('services')
      .select(SERVICE_SELECT_COLUMNS)
      .eq('id', id)
      .maybeSingle()

    return {
      data: (data as ServiceListingRow | null) ?? null,
      error,
    }
  },

  async insert(
    providerId: string,
    _providerName: string,
    input: CreateServiceListingInput,
    accessToken: string
  ) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('services')
      .insert({
        provider_id: providerId,
        category_id: input.categoryId,
        name: input.name,
        description: input.description,
        price: input.price,
        is_active: input.isActive ?? true,
      })
      .select(SERVICE_SELECT_COLUMNS)
      .single()

    return {
      data: (data as ServiceListingRow | null) ?? null,
      error,
    }
  },

  async updateById(
    id: string,
    input: UpdateServiceListingInput,
    accessToken: string
  ) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient(accessToken)

    const payload: Record<string, unknown> = {}
    if (input.categoryId !== undefined) payload.category_id = input.categoryId
    if (input.name !== undefined) payload.name = input.name
    if (input.description !== undefined) payload.description = input.description
    if (input.price !== undefined) payload.price = input.price
    if (input.isActive !== undefined) payload.is_active = input.isActive

    const { data, error } = await client
      .from('services')
      .update(payload)
      .eq('id', id)
      .select(SERVICE_SELECT_COLUMNS)
      .maybeSingle()

    return {
      data: (data as ServiceListingRow | null) ?? null,
      error,
    }
  },

  async deleteById(id: string, accessToken: string) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('services')
      .delete()
      .eq('id', id)
      .select(SERVICE_SELECT_COLUMNS)
      .maybeSingle()

    return {
      data: (data as ServiceListingRow | null) ?? null,
      error,
    }
  },
}

let activeServiceListingStore: ServiceListingStore = supabaseServiceListingStore

export function setServiceListingStoreForTesting(
  store: ServiceListingStore | null
): void {
  activeServiceListingStore = store ?? supabaseServiceListingStore
}

export function normalizeServiceName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const { exists, error } =
    await activeServiceListingStore.categoryExists(categoryId)

  if (error) {
    throw mapServiceListingDatabaseError('verify_category', error)
  }

  if (!exists) {
    throw new AppError(
      400,
      'INVALID_CATEGORY_REFERENCE',
      'Kategori jasa yang dipilih tidak ditemukan pada sistem.',
      {
        categoryId: 'Kategori jasa yang dipilih tidak ditemukan pada sistem.',
      }
    )
  }
}

function assertServiceOwnership(
  serviceRow: ServiceListingRow,
  providerId: string
): void {
  if (serviceRow.provider_id !== providerId) {
    throw new AppError(
      403,
      'SERVICE_OWNERSHIP_FORBIDDEN',
      'Kamu tidak memiliki izin untuk mengubah atau menghapus layanan milik penyedia jasa lain.'
    )
  }
}

export async function listPublicServices(filter?: {
  categoryId?: string
}): Promise<ServiceListingDto[]> {
  const { data, error } = await activeServiceListingStore.findPublic(filter)

  if (error) {
    throw mapServiceListingDatabaseError('list_public', error)
  }

  return (data ?? []).map(mapServiceListingRow)
}

export async function listProviderServices(
  providerId: string,
  accessToken: string
): Promise<ServiceListingDto[]> {
  const { data, error } = await activeServiceListingStore.findByProviderId(
    providerId,
    accessToken
  )

  if (error) {
    throw mapServiceListingDatabaseError('list_provider', error)
  }

  return (data ?? []).map(mapServiceListingRow)
}

export async function getServiceListingById(
  id: string,
  accessToken?: string
): Promise<ServiceListingDto> {
  const { data, error } = await activeServiceListingStore.findById(
    id,
    accessToken
  )

  if (error) {
    throw mapServiceListingDatabaseError('detail', error)
  }

  if (!data) {
    throw new AppError(404, 'SERVICE_NOT_FOUND', 'Layanan jasa tidak ditemukan.')
  }

  return mapServiceListingRow(data)
}

export async function createServiceListing(
  providerId: string,
  providerName: string,
  input: CreateServiceListingInput,
  accessToken: string
): Promise<ServiceListingDto> {
  const normalizedInput: CreateServiceListingInput = {
    categoryId: input.categoryId.trim(),
    name: normalizeServiceName(input.name),
    description: input.description.trim(),
    price: input.price,
    isActive: input.isActive ?? true,
  }

  await assertCategoryExists(normalizedInput.categoryId)

  const { data, error } = await activeServiceListingStore.insert(
    providerId,
    providerName,
    normalizedInput,
    accessToken
  )

  if (error) {
    throw mapServiceListingDatabaseError('create', error)
  }

  if (!data) {
    throw new AppError(
      502,
      'SERVICE_LISTING_ERROR',
      'Layanan jasa baru gagal disimpan. Silakan coba lagi.'
    )
  }

  return mapServiceListingRow(data)
}

export async function updateServiceListing(
  id: string,
  providerId: string,
  input: UpdateServiceListingInput,
  accessToken: string
): Promise<ServiceListingDto> {
  const { data: existing, error: findError } =
    await activeServiceListingStore.findById(id, accessToken)

  if (findError) {
    throw mapServiceListingDatabaseError('find_before_update', findError)
  }

  if (!existing) {
    throw new AppError(404, 'SERVICE_NOT_FOUND', 'Layanan jasa tidak ditemukan.')
  }

  assertServiceOwnership(existing, providerId)

  const normalizedInput: UpdateServiceListingInput = {}

  if (input.categoryId !== undefined) {
    const trimmedCategoryId = input.categoryId.trim()
    await assertCategoryExists(trimmedCategoryId)
    normalizedInput.categoryId = trimmedCategoryId
  }

  if (input.name !== undefined) {
    normalizedInput.name = normalizeServiceName(input.name)
  }

  if (input.description !== undefined) {
    normalizedInput.description = input.description.trim()
  }

  if (input.price !== undefined) {
    normalizedInput.price = input.price
  }

  if (input.isActive !== undefined) {
    normalizedInput.isActive = input.isActive
  }

  const { data, error } = await activeServiceListingStore.updateById(
    id,
    normalizedInput,
    accessToken
  )

  if (error) {
    throw mapServiceListingDatabaseError('update', error)
  }

  if (!data) {
    throw new AppError(404, 'SERVICE_NOT_FOUND', 'Layanan jasa tidak ditemukan.')
  }

  return mapServiceListingRow(data)
}

export async function deleteServiceListing(
  id: string,
  providerId: string,
  accessToken: string
): Promise<ServiceListingDto> {
  const { data: existing, error: findError } =
    await activeServiceListingStore.findById(id, accessToken)

  if (findError) {
    throw mapServiceListingDatabaseError('find_before_delete', findError)
  }

  if (!existing) {
    throw new AppError(404, 'SERVICE_NOT_FOUND', 'Layanan jasa tidak ditemukan.')
  }

  assertServiceOwnership(existing, providerId)

  const { data, error } = await activeServiceListingStore.deleteById(
    id,
    accessToken
  )

  if (error) {
    throw mapServiceListingDatabaseError('delete', error)
  }

  if (!data) {
    throw new AppError(404, 'SERVICE_NOT_FOUND', 'Layanan jasa tidak ditemukan.')
  }

  return mapServiceListingRow(data)
}

