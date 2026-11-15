import { createSupabaseClient, supabaseConfigured } from '../config/supabase'
import { AppError } from '../lib/errors'

export type FavoriteItemType = 'service' | 'provider'

export interface FavoriteTargetDetails {
  title: string
  subtitle?: string | null
  description?: string | null
  price?: number | null
  categoryName?: string | null
  providerName?: string | null
  whatsappNumber?: string | null
  serviceArea?: string | null
  isActive?: boolean | null
}

export interface FavoriteDto {
  id: string
  customerId: string
  itemType: FavoriteItemType
  serviceId: string | null
  providerId: string | null
  label: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  target: FavoriteTargetDetails
}

export interface FavoriteRow {
  id: string
  customer_id: string
  item_type: FavoriteItemType
  service_id: string | null
  provider_id: string | null
  label: string | null
  notes: string | null
  created_at: string
  updated_at: string
  services?: {
    id: string
    name: string
    description: string
    price: number
    is_active: boolean
    categories?: { name?: string | null } | Array<{ name?: string | null }> | null
    profiles?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null
  } | null
  profiles?: {
    id: string
    full_name: string
    provider_profiles?:
      | {
          business_name?: string | null
          bio?: string | null
          whatsapp_number?: string | null
          service_area?: string | null
        }
      | Array<{
          business_name?: string | null
          bio?: string | null
          whatsapp_number?: string | null
          service_area?: string | null
        }>
      | null
  } | null
}

export interface CreateFavoriteInput {
  itemType: FavoriteItemType
  serviceId?: string | null
  providerId?: string | null
  label?: string | null
  notes?: string | null
}

export interface UpdateFavoriteInput {
  label?: string | null
  notes?: string | null
}

export interface DatabaseErrorLike {
  code?: string
  message?: string
  details?: string | null
}

export interface FavoriteStore {
  findByCustomer(
    customerId: string,
    accessToken?: string,
    itemType?: FavoriteItemType
  ): Promise<{ data: FavoriteRow[] | null; error: DatabaseErrorLike | null }>

  findById(
    id: string,
    accessToken?: string
  ): Promise<{ data: FavoriteRow | null; error: DatabaseErrorLike | null }>

  findExisting(
    customerId: string,
    itemType: FavoriteItemType,
    targetId: string,
    accessToken?: string
  ): Promise<{ data: FavoriteRow | null; error: DatabaseErrorLike | null }>

  insert(
    customerId: string,
    input: CreateFavoriteInput,
    accessToken?: string
  ): Promise<{ data: FavoriteRow | null; error: DatabaseErrorLike | null }>

  updateById(
    id: string,
    customerId: string,
    input: UpdateFavoriteInput,
    accessToken?: string
  ): Promise<{ data: FavoriteRow | null; error: DatabaseErrorLike | null }>

  deleteById(
    id: string,
    customerId: string,
    accessToken?: string
  ): Promise<{ data: FavoriteRow | null; error: DatabaseErrorLike | null }>
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateUuid(val: unknown, fieldName: string): string {
  if (typeof val !== 'string' || !UUID_REGEX.test(val.trim())) {
    throw new AppError(400, 'VALIDATION_ERROR', `Format ${fieldName} tidak valid.`, {
      [fieldName]: `Format ${fieldName} tidak valid.`,
    })
  }
  return val.trim()
}

export function validateCreateFavoriteInput(raw: unknown): CreateFavoriteInput {
  if (typeof raw !== 'object' || raw === null) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Payload permintaan tidak valid.')
  }

  const body = raw as Record<string, unknown>
  const errors: Record<string, string> = {}

  const itemType = body.itemType
  if (itemType !== 'service' && itemType !== 'provider') {
    errors.itemType = 'Tipe item favorit harus "service" atau "provider".'
  }

  let serviceId: string | null = null
  let providerId: string | null = null

  if (itemType === 'service') {
    if (!body.serviceId || typeof body.serviceId !== 'string' || !UUID_REGEX.test(body.serviceId.trim())) {
      errors.serviceId = 'ID jasa wajib diisi dan harus berupa UUID yang valid.'
    } else {
      serviceId = body.serviceId.trim()
    }
  } else if (itemType === 'provider') {
    if (!body.providerId || typeof body.providerId !== 'string' || !UUID_REGEX.test(body.providerId.trim())) {
      errors.providerId = 'ID penyedia wajib diisi dan harus berupa UUID yang valid.'
    } else {
      providerId = body.providerId.trim()
    }
  }

  let label: string | null = null
  if (body.label !== undefined && body.label !== null) {
    if (typeof body.label !== 'string') {
      errors.label = 'Label harus berupa teks.'
    } else {
      const trimmed = body.label.trim()
      if (trimmed.length > 50) {
        errors.label = 'Label maksimal 50 karakter.'
      } else {
        label = trimmed || null
      }
    }
  }

  let notes: string | null = null
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string') {
      errors.notes = 'Catatan harus berupa teks.'
    } else {
      const trimmed = body.notes.trim()
      if (trimmed.length > 500) {
        errors.notes = 'Catatan maksimal 500 karakter.'
      } else {
        notes = trimmed || null
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Data favorit tidak valid.', errors)
  }

  return {
    itemType: itemType as FavoriteItemType,
    serviceId,
    providerId,
    label,
    notes,
  }
}

export function validateUpdateFavoriteInput(raw: unknown): UpdateFavoriteInput {
  if (typeof raw !== 'object' || raw === null) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Payload permintaan tidak valid.')
  }

  const body = raw as Record<string, unknown>
  const errors: Record<string, string> = {}

  if (body.label === undefined && body.notes === undefined) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Minimal satu field (label atau notes) harus disertakan.')
  }

  let label: string | null | undefined = undefined
  if (body.label !== undefined) {
    if (body.label === null) {
      label = null
    } else if (typeof body.label !== 'string') {
      errors.label = 'Label harus berupa teks.'
    } else {
      const trimmed = body.label.trim()
      if (trimmed.length > 50) {
        errors.label = 'Label maksimal 50 karakter.'
      } else {
        label = trimmed || null
      }
    }
  }

  let notes: string | null | undefined = undefined
  if (body.notes !== undefined) {
    if (body.notes === null) {
      notes = null
    } else if (typeof body.notes !== 'string') {
      errors.notes = 'Catatan harus berupa teks.'
    } else {
      const trimmed = body.notes.trim()
      if (trimmed.length > 500) {
        errors.notes = 'Catatan maksimal 500 karakter.'
      } else {
        notes = trimmed || null
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Perubahan favorit tidak valid.', errors)
  }

  return {
    ...(label !== undefined ? { label } : {}),
    ...(notes !== undefined ? { notes } : {}),
  }
}

export function mapRowToDto(row: FavoriteRow): FavoriteDto {
  let target: FavoriteTargetDetails = {
    title: 'Item Tidak Ditemukan',
  }

  if (row.item_type === 'service' && row.services) {
    const s = row.services
    let categoryName = 'Umum'
    if (Array.isArray(s.categories)) {
      categoryName = s.categories[0]?.name || categoryName
    } else if (s.categories?.name) {
      categoryName = s.categories.name
    }

    let providerName = 'Penyedia Jasa LOKA'
    if (Array.isArray(s.profiles)) {
      providerName = s.profiles[0]?.full_name || providerName
    } else if (s.profiles?.full_name) {
      providerName = s.profiles.full_name
    }

    target = {
      title: s.name,
      subtitle: categoryName,
      description: s.description,
      price: s.price,
      categoryName,
      providerName,
      isActive: s.is_active,
    }
  } else if (row.item_type === 'provider' && row.profiles) {
    const p = row.profiles
    let provProfile: {
      business_name?: string | null
      bio?: string | null
      whatsapp_number?: string | null
      service_area?: string | null
    } | null = null

    if (Array.isArray(p.provider_profiles)) {
      provProfile = p.provider_profiles[0] || null
    } else if (p.provider_profiles) {
      provProfile = p.provider_profiles
    }

    target = {
      title: provProfile?.business_name || p.full_name || 'Penyedia Jasa',
      subtitle: p.full_name,
      description: provProfile?.bio || null,
      whatsappNumber: provProfile?.whatsapp_number || null,
      serviceArea: provProfile?.service_area || null,
      isActive: true,
    }
  }

  return {
    id: row.id,
    customerId: row.customer_id,
    itemType: row.item_type,
    serviceId: row.service_id,
    providerId: row.provider_id,
    label: row.label,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    target,
  }
}

const SELECT_QUERY = `
  id,
  customer_id,
  item_type,
  service_id,
  provider_id,
  label,
  notes,
  created_at,
  updated_at,
  services (
    id,
    name,
    description,
    price,
    is_active,
    categories ( name ),
    profiles!services_provider_id_fkey ( full_name )
  ),
  profiles!customer_favorites_provider_id_fkey (
    id,
    full_name,
    provider_profiles (
      business_name,
      bio,
      whatsapp_number,
      service_area
    )
  )
`

export class SupabaseFavoriteStore implements FavoriteStore {
  async findByCustomer(
    customerId: string,
    accessToken?: string,
    itemType?: FavoriteItemType
  ): Promise<{ data: FavoriteRow[] | null; error: DatabaseErrorLike | null }> {
    if (!supabaseConfigured) return { data: [], error: null }
    const client = createSupabaseClient(accessToken)

    let query = client
      .from('customer_favorites')
      .select(SELECT_QUERY)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (itemType) {
      query = query.eq('item_type', itemType)
    }

    const { data, error } = await query
    return { data: (data as unknown as FavoriteRow[]) ?? null, error }
  }

  async findById(
    id: string,
    accessToken?: string
  ): Promise<{ data: FavoriteRow | null; error: DatabaseErrorLike | null }> {
    if (!supabaseConfigured) return { data: null, error: null }
    const client = createSupabaseClient(accessToken)

    const { data, error } = await client
      .from('customer_favorites')
      .select(SELECT_QUERY)
      .eq('id', id)
      .maybeSingle()

    return { data: (data as unknown as FavoriteRow) ?? null, error }
  }

  async findExisting(
    customerId: string,
    itemType: FavoriteItemType,
    targetId: string,
    accessToken?: string
  ): Promise<{ data: FavoriteRow | null; error: DatabaseErrorLike | null }> {
    if (!supabaseConfigured) return { data: null, error: null }
    const client = createSupabaseClient(accessToken)

    const targetColumn = itemType === 'service' ? 'service_id' : 'provider_id'
    const { data, error } = await client
      .from('customer_favorites')
      .select(SELECT_QUERY)
      .eq('customer_id', customerId)
      .eq('item_type', itemType)
      .eq(targetColumn, targetId)
      .maybeSingle()

    return { data: (data as unknown as FavoriteRow) ?? null, error }
  }

  async insert(
    customerId: string,
    input: CreateFavoriteInput,
    accessToken?: string
  ): Promise<{ data: FavoriteRow | null; error: DatabaseErrorLike | null }> {
    if (!supabaseConfigured) return { data: null, error: null }
    const client = createSupabaseClient(accessToken)

    const insertPayload = {
      customer_id: customerId,
      item_type: input.itemType,
      service_id: input.serviceId ?? null,
      provider_id: input.providerId ?? null,
      label: input.label ?? null,
      notes: input.notes ?? null,
    }

    const { data, error } = await client
      .from('customer_favorites')
      .insert(insertPayload)
      .select(SELECT_QUERY)
      .single()

    return { data: (data as unknown as FavoriteRow) ?? null, error }
  }

  async updateById(
    id: string,
    customerId: string,
    input: UpdateFavoriteInput,
    accessToken?: string
  ): Promise<{ data: FavoriteRow | null; error: DatabaseErrorLike | null }> {
    if (!supabaseConfigured) return { data: null, error: null }
    const client = createSupabaseClient(accessToken)

    const updatePayload: Record<string, unknown> = {}
    if (input.label !== undefined) updatePayload.label = input.label
    if (input.notes !== undefined) updatePayload.notes = input.notes

    const { data, error } = await client
      .from('customer_favorites')
      .update(updatePayload)
      .eq('id', id)
      .eq('customer_id', customerId)
      .select(SELECT_QUERY)
      .maybeSingle()

    return { data: (data as unknown as FavoriteRow) ?? null, error }
  }

  async deleteById(
    id: string,
    customerId: string,
    accessToken?: string
  ): Promise<{ data: FavoriteRow | null; error: DatabaseErrorLike | null }> {
    if (!supabaseConfigured) return { data: null, error: null }
    const client = createSupabaseClient(accessToken)

    const { data, error } = await client
      .from('customer_favorites')
      .delete()
      .eq('id', id)
      .eq('customer_id', customerId)
      .select(SELECT_QUERY)
      .maybeSingle()

    return { data: (data as unknown as FavoriteRow) ?? null, error }
  }
}

let activeStore: FavoriteStore = new SupabaseFavoriteStore()

export function setFavoriteStoreForTesting(store: FavoriteStore): void {
  activeStore = store
}

export function resetFavoriteStore(): void {
  activeStore = new SupabaseFavoriteStore()
}

/**
 * Service functions implementing TPR-94 CRUD operations
 */
export async function listFavorites(
  customerId: string,
  accessToken?: string,
  itemType?: FavoriteItemType
): Promise<FavoriteDto[]> {
  const { data, error } = await activeStore.findByCustomer(customerId, accessToken, itemType)
  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal memuat daftar favorit.')
  }
  return (data || []).map(mapRowToDto)
}

export async function getFavoriteById(
  id: string,
  customerId: string,
  accessToken?: string
): Promise<FavoriteDto> {
  const validatedId = validateUuid(id, 'id')
  const { data, error } = await activeStore.findById(validatedId, accessToken)

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal memuat data item favorit.')
  }
  if (!data) {
    throw new AppError(404, 'FAVORITE_NOT_FOUND', 'Item favorit tidak ditemukan.')
  }
  if (data.customer_id !== customerId) {
    throw new AppError(403, 'FAVORITE_FORBIDDEN', 'Anda tidak memiliki hak akses untuk item favorit ini.')
  }

  return mapRowToDto(data)
}

export async function addFavorite(
  customerId: string,
  rawInput: unknown,
  accessToken?: string
): Promise<FavoriteDto> {
  const input = validateCreateFavoriteInput(rawInput)
  const targetId = input.itemType === 'service' ? input.serviceId! : input.providerId!

  const existing = await activeStore.findExisting(customerId, input.itemType, targetId, accessToken)
  if (existing.data) {
    throw new AppError(409, 'FAVORITE_ALREADY_EXISTS', 'Item ini sudah ada di daftar favorit Anda.')
  }

  const { data, error } = await activeStore.insert(customerId, input, accessToken)
  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'FAVORITE_ALREADY_EXISTS', 'Item ini sudah ada di daftar favorit Anda.')
    }
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal menambahkan item ke favorit.')
  }

  if (!data) {
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal menyimpan item ke favorit.')
  }

  return mapRowToDto(data)
}

export async function updateFavorite(
  id: string,
  customerId: string,
  rawInput: unknown,
  accessToken?: string
): Promise<FavoriteDto> {
  const validatedId = validateUuid(id, 'id')
  const input = validateUpdateFavoriteInput(rawInput)

  const existing = await activeStore.findById(validatedId, accessToken)
  if (!existing.data) {
    throw new AppError(404, 'FAVORITE_NOT_FOUND', 'Item favorit tidak ditemukan.')
  }
  if (existing.data.customer_id !== customerId) {
    throw new AppError(403, 'FAVORITE_FORBIDDEN', 'Anda tidak diizinkan mengubah favorit pengguna lain.')
  }

  const { data, error } = await activeStore.updateById(validatedId, customerId, input, accessToken)
  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal memperbarui item favorit.')
  }

  if (!data) {
    throw new AppError(404, 'FAVORITE_NOT_FOUND', 'Item favorit tidak ditemukan saat update.')
  }

  return mapRowToDto(data)
}

export async function removeFavorite(
  id: string,
  customerId: string,
  accessToken?: string
): Promise<{ deletedId: string }> {
  const validatedId = validateUuid(id, 'id')

  const existing = await activeStore.findById(validatedId, accessToken)
  if (!existing.data) {
    throw new AppError(404, 'FAVORITE_NOT_FOUND', 'Item favorit tidak ditemukan.')
  }
  if (existing.data.customer_id !== customerId) {
    throw new AppError(403, 'FAVORITE_FORBIDDEN', 'Anda tidak diizinkan menghapus favorit pengguna lain.')
  }

  const { error } = await activeStore.deleteById(validatedId, customerId, accessToken)
  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Gagal menghapus item dari favorit.')
  }

  return { deletedId: validatedId }
}
