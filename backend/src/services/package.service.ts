import { createSupabaseClient, supabaseConfigured } from '../config/supabase'
import { AppError } from '../lib/errors'
import type { DatabaseErrorLike } from './category.service'

export interface PackageDto {
  id: string
  serviceId: string
  name: string
  description: string | null
  price: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PackageRow {
  id: string
  service_id: string
  name: string
  description: string | null
  price: number
  is_active: boolean
  deleted_at?: string | null
  created_at: string
  updated_at: string
}

export interface CreatePackageInput {
  serviceId: string
  name: string
  description: string | null
  price: number
  isActive: boolean
}

export interface UpdatePackageInput {
  name?: string
  description?: string | null
  price?: number
  isActive?: boolean
}

export interface ServiceOwnerRow {
  id: string
  provider_id: string
}

type StoreResult<T> = Promise<{ data: T; error: DatabaseErrorLike | null }>

export const MAX_PACKAGES_PER_SERVICE = 10

export interface PackageStore {
  isServicePubliclyVisible(serviceId: string): StoreResult<boolean | null>
  findServiceOwner(
    serviceId: string,
    accessToken: string
  ): StoreResult<ServiceOwnerRow | null>
  findPublicByServiceId(serviceId: string): StoreResult<PackageRow[] | null>
  findByServiceId(serviceId: string, accessToken: string): StoreResult<PackageRow[] | null>
  findById(id: string, accessToken: string): StoreResult<PackageRow | null>
  insert(input: CreatePackageInput, accessToken: string): StoreResult<PackageRow | null>
  updateById(
    id: string,
    input: UpdatePackageInput,
    accessToken: string
  ): StoreResult<PackageRow | null>
  softDeleteById(id: string, accessToken: string): StoreResult<PackageRow | null>
}

const PACKAGE_COLUMNS =
  'id, service_id, name, description, price, is_active, deleted_at, created_at, updated_at'

function ensureSupabaseConfigured(): void {
  if (!supabaseConfigured) {
    throw new AppError(
      503,
      'PACKAGE_SERVICE_UNAVAILABLE',
      'Layanan database paket belum dikonfigurasi. Hubungi administrator LOKA.'
    )
  }
}

export function mapPackageRow(row: PackageRow): PackageDto {
  return {
    id: row.id,
    serviceId: row.service_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapPackageDatabaseError(
  action: string,
  error: DatabaseErrorLike
): AppError {
  const code = error.code ?? ''

  if (code === '23505') {
    return new AppError(
      409,
      'DUPLICATE_PACKAGE_NAME',
      'Nama paket sudah dipakai di jasa ini.',
      { name: 'Nama paket sudah dipakai di jasa ini.' }
    )
  }

  if (code === '23514') {
    return new AppError(400, 'VALIDATION_ERROR', 'Data paket tidak valid.')
  }

  if (code === '22P02') {
    return new AppError(400, 'INVALID_PACKAGE_ID', 'Format ID paket tidak valid.')
  }

  if (code === '42501') {
    return new AppError(
      403,
      'PACKAGE_OWNERSHIP_FORBIDDEN',
      'Kamu tidak memiliki izin untuk mengelola paket di jasa ini.'
    )
  }

  console.error('[package] Database error', { action, code: code || 'unknown' })

  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202') {
    return new AppError(
      503,
      'PACKAGE_TABLE_UNAVAILABLE',
      'Tabel paket belum tersedia pada database. Hubungi administrator LOKA.'
    )
  }

  return new AppError(
    502,
    'PACKAGE_SERVICE_ERROR',
    'Layanan paket sedang bermasalah. Silakan coba lagi.'
  )
}

const supabasePackageStore: PackageStore = {
  async isServicePubliclyVisible(serviceId) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient().rpc(
      'is_service_publicly_visible',
      { p_service_id: serviceId }
    )
    return { data: typeof data === 'boolean' ? data : null, error }
  },

  async findServiceOwner(serviceId, accessToken) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient(accessToken)
      .from('services')
      .select('id, provider_id')
      .eq('id', serviceId)
      .maybeSingle()
    return { data: (data as ServiceOwnerRow | null) ?? null, error }
  },

  async findPublicByServiceId(serviceId) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient()
      .from('service_packages')
      .select(PACKAGE_COLUMNS)
      .eq('service_id', serviceId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('price', { ascending: true })
      .order('created_at', { ascending: true })
    return { data: (data as PackageRow[] | null) ?? null, error }
  },

  async findByServiceId(serviceId, accessToken) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient(accessToken)
      .from('service_packages')
      .select(PACKAGE_COLUMNS)
      .eq('service_id', serviceId)
      .is('deleted_at', null)
      .order('price', { ascending: true })
      .order('created_at', { ascending: true })
    return { data: (data as PackageRow[] | null) ?? null, error }
  },

  async findById(id, accessToken) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient(accessToken)
      .from('service_packages')
      .select(PACKAGE_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    return { data: (data as PackageRow | null) ?? null, error }
  },

  async insert(input, accessToken) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient(accessToken)
      .from('service_packages')
      .insert({
        service_id: input.serviceId,
        name: input.name,
        description: input.description,
        price: input.price,
        is_active: input.isActive,
      })
      .select(PACKAGE_COLUMNS)
      .single()
    return { data: (data as PackageRow | null) ?? null, error }
  },

  async updateById(id, input, accessToken) {
    ensureSupabaseConfigured()
    const payload: Record<string, unknown> = {}
    if (input.name !== undefined) payload.name = input.name
    if (input.description !== undefined) payload.description = input.description
    if (input.price !== undefined) payload.price = input.price
    if (input.isActive !== undefined) payload.is_active = input.isActive

    const { data, error } = await createSupabaseClient(accessToken)
      .from('service_packages')
      .update(payload)
      .eq('id', id)
      .is('deleted_at', null)
      .select(PACKAGE_COLUMNS)
      .maybeSingle()
    return { data: (data as PackageRow | null) ?? null, error }
  },

  async softDeleteById(id, accessToken) {
    ensureSupabaseConfigured()
    const { data, error } = await createSupabaseClient(accessToken)
      .from('service_packages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select(PACKAGE_COLUMNS)
      .maybeSingle()
    return { data: (data as PackageRow | null) ?? null, error }
  },
}

let activePackageStore: PackageStore = supabasePackageStore

export function setPackageStoreForTesting(store: PackageStore | null): void {
  activePackageStore = store ?? supabasePackageStore
}

function packageNotFound(): AppError {
  return new AppError(404, 'PACKAGE_NOT_FOUND', 'Paket tidak ditemukan.')
}

export async function listPublicPackages(serviceId: string): Promise<PackageDto[]> {
  const visible = await activePackageStore.isServicePubliclyVisible(serviceId)
  if (visible.error) {
    throw mapPackageDatabaseError('check_service_visible', visible.error)
  }
  if (!visible.data) {
    throw new AppError(404, 'SERVICE_NOT_FOUND', 'Jasa tidak ditemukan.')
  }

  const { data, error } = await activePackageStore.findPublicByServiceId(serviceId)
  if (error) throw mapPackageDatabaseError('list_public', error)
  return (data ?? []).map(mapPackageRow)
}

function duplicateNameError(): AppError {
  return new AppError(409, 'DUPLICATE_PACKAGE_NAME', 'Nama paket sudah dipakai di jasa ini.', {
    name: 'Nama paket sudah dipakai di jasa ini.',
  })
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

// Kepemilikan dicek di backend (pesan jelas) dan tetap dijaga RLS di database.
async function assertServiceOwnedBy(
  serviceId: string,
  providerId: string,
  accessToken: string
): Promise<void> {
  const { data, error } = await activePackageStore.findServiceOwner(serviceId, accessToken)
  if (error) throw mapPackageDatabaseError('find_service_owner', error)
  if (!data) {
    throw new AppError(404, 'SERVICE_NOT_FOUND', 'Jasa tidak ditemukan.')
  }
  if (data.provider_id !== providerId) {
    throw new AppError(
      403,
      'PACKAGE_OWNERSHIP_FORBIDDEN',
      'Kamu tidak memiliki izin untuk mengelola paket di jasa milik penyedia lain.'
    )
  }
}

async function loadOwnedPackage(
  id: string,
  providerId: string,
  accessToken: string
): Promise<PackageRow> {
  const { data, error } = await activePackageStore.findById(id, accessToken)
  if (error) throw mapPackageDatabaseError('find_package', error)
  if (!data) throw packageNotFound()
  await assertServiceOwnedBy(data.service_id, providerId, accessToken)
  return data
}

async function loadServicePackages(
  serviceId: string,
  accessToken: string
): Promise<PackageRow[]> {
  const { data, error } = await activePackageStore.findByServiceId(serviceId, accessToken)
  if (error) throw mapPackageDatabaseError('list_provider', error)
  return data ?? []
}

export async function listProviderPackages(
  serviceId: string,
  providerId: string,
  accessToken: string
): Promise<PackageDto[]> {
  await assertServiceOwnedBy(serviceId, providerId, accessToken)
  const rows = await loadServicePackages(serviceId, accessToken)
  return rows.map(mapPackageRow)
}

export async function createPackage(
  input: CreatePackageInput,
  providerId: string,
  accessToken: string
): Promise<PackageDto> {
  await assertServiceOwnedBy(input.serviceId, providerId, accessToken)

  // Batas 10 paket dicek di backend saja (tanpa trigger database), keputusan TPR-5.
  const existing = await loadServicePackages(input.serviceId, accessToken)
  if (existing.length >= MAX_PACKAGES_PER_SERVICE) {
    throw new AppError(
      409,
      'PACKAGE_LIMIT_REACHED',
      `Maksimal ${MAX_PACKAGES_PER_SERVICE} paket per jasa. Hapus paket lama untuk menambah yang baru.`
    )
  }
  if (existing.some((row) => sameName(row.name, input.name))) {
    throw duplicateNameError()
  }

  const { data, error } = await activePackageStore.insert(input, accessToken)
  if (error) throw mapPackageDatabaseError('create', error)
  if (!data) {
    throw new AppError(
      502,
      'PACKAGE_SERVICE_ERROR',
      'Paket baru gagal disimpan. Silakan coba lagi.'
    )
  }
  return mapPackageRow(data)
}

export async function updatePackage(
  id: string,
  input: UpdatePackageInput,
  providerId: string,
  accessToken: string
): Promise<PackageDto> {
  const current = await loadOwnedPackage(id, providerId, accessToken)

  if (input.name !== undefined && !sameName(input.name, current.name)) {
    const siblings = await loadServicePackages(current.service_id, accessToken)
    if (siblings.some((row) => row.id !== id && sameName(row.name, input.name!))) {
      throw duplicateNameError()
    }
  }

  const { data, error } = await activePackageStore.updateById(id, input, accessToken)
  if (error) throw mapPackageDatabaseError('update', error)
  if (!data) throw packageNotFound()
  return mapPackageRow(data)
}

export async function deletePackage(
  id: string,
  providerId: string,
  accessToken: string
): Promise<PackageDto> {
  await loadOwnedPackage(id, providerId, accessToken)

  const { data, error } = await activePackageStore.softDeleteById(id, accessToken)
  if (error) throw mapPackageDatabaseError('delete', error)
  if (!data) throw packageNotFound()
  return mapPackageRow(data)
}
