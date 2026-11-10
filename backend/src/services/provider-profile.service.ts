import { createSupabaseClient, supabaseConfigured } from '../config/supabase'
import { AppError } from '../lib/errors'
import type { DatabaseErrorLike } from './category.service'

export const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type DayKey = (typeof DAY_KEYS)[number]

export interface DaySchedule {
  isOpen: boolean
  open?: string
  close?: string
}

export type OperatingHours = Record<DayKey, DaySchedule>

export interface ProviderProfileDto {
  id: string
  businessName: string
  bio: string | null
  whatsappNumber: string
  address: string
  serviceArea: string
  operatingHours: OperatingHours
  primaryCategory: { id: string; name: string }
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export interface ProviderProfileWriteInput {
  businessName: string
  bio: string | null
  whatsappNumber: string
  address: string
  serviceArea: string
  operatingHours: OperatingHours
  primaryCategoryId: string
  isPublic: boolean
}

export type ProviderProfileUpdateInput = Partial<ProviderProfileWriteInput>

export interface ProviderProfileRow {
  profile_id: string
  business_name: string
  bio: string | null
  whatsapp_number: string
  address: string
  service_area: string
  operating_hours: unknown
  primary_category_id: string
  is_public: boolean
  created_at: string
  updated_at: string
  categories?: { name?: string | null } | Array<{ name?: string | null }> | null
}

export interface ProviderProfileStore {
  categoryExists(categoryId: string): Promise<{
    exists: boolean
    error: DatabaseErrorLike | null
  }>
  findById(
    profileId: string,
    accessToken: string
  ): Promise<{
    data: ProviderProfileRow | null
    error: DatabaseErrorLike | null
  }>
  findPublicById(profileId: string): Promise<{
    data: ProviderProfileRow | null
    error: DatabaseErrorLike | null
  }>
  upsert(
    profileId: string,
    input: ProviderProfileWriteInput,
    accessToken: string
  ): Promise<{
    data: ProviderProfileRow | null
    error: DatabaseErrorLike | null
  }>
  updateById(
    profileId: string,
    input: ProviderProfileUpdateInput,
    accessToken: string
  ): Promise<{
    data: ProviderProfileRow | null
    error: DatabaseErrorLike | null
  }>
}

const PROVIDER_PROFILE_COLUMNS =
  'profile_id, business_name, bio, whatsapp_number, address, service_area, operating_hours, primary_category_id, is_public, created_at, updated_at, categories(name)'

function ensureSupabaseConfigured(): void {
  if (!supabaseConfigured) {
    throw new AppError(
      503,
      'PROVIDER_PROFILE_UNAVAILABLE',
      'Layanan profil penyedia belum dikonfigurasi. Hubungi administrator LOKA.'
    )
  }
}

function logDatabaseError(action: string, error: DatabaseErrorLike): void {
  console.error('[provider-profile] Database error', {
    action,
    code: error.code ?? 'unknown',
  })
}

export function mapProviderProfileDatabaseError(
  action: string,
  error: DatabaseErrorLike
): AppError {
  const code = error.code ?? ''

  if (code === '23503') {
    return new AppError(
      400,
      'INVALID_CATEGORY_REFERENCE',
      'Kategori utama yang dipilih tidak ditemukan pada sistem.',
      {
        primaryCategoryId:
          'Kategori utama yang dipilih tidak ditemukan pada sistem.',
      }
    )
  }

  if (code === '22P02') {
    return new AppError(
      400,
      'INVALID_PROVIDER_ID',
      'Format ID penyedia tidak valid.'
    )
  }

  if (code === '42501') {
    return new AppError(
      403,
      'PROVIDER_PROFILE_FORBIDDEN',
      'Kamu tidak memiliki izin untuk mengelola profil penyedia ini.'
    )
  }

  if (code === '42P01' || code === 'PGRST205') {
    logDatabaseError(action, error)
    return new AppError(
      503,
      'PROVIDER_PROFILE_TABLE_UNAVAILABLE',
      'Tabel profil penyedia belum tersedia pada database. Hubungi administrator LOKA.'
    )
  }

  logDatabaseError(action, error)
  return new AppError(
    502,
    'PROVIDER_PROFILE_ERROR',
    'Layanan profil penyedia sedang bermasalah. Silakan coba lagi.'
  )
}

function resolveJoinedCategoryName(row: ProviderProfileRow): string {
  const joined = row.categories
  if (Array.isArray(joined)) {
    const first = joined[0]?.name
    if (first && first.trim()) return first.trim()
  } else if (joined && typeof joined === 'object' && joined.name?.trim()) {
    return joined.name.trim()
  }

  return 'Kategori Jasa'
}

export function normalizeBusinessName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/**
 * Normalizes an Indonesian WhatsApp number to the `62...` format used by
 * https://wa.me links. Returns digits only; callers must validate the result.
 */
export function normalizeWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, '')

  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`
  }

  if (digits.startsWith('8')) {
    return `62${digits}`
  }

  return digits
}

export function isValidWhatsAppNumber(value: string): boolean {
  return /^628[0-9]{7,12}$/.test(value)
}

export function normalizeOperatingHours(raw: unknown): OperatingHours {
  const source =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const result = {} as OperatingHours

  for (const day of DAY_KEYS) {
    const value = source[day]
    const schedule =
      value && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {}

    if (schedule.isOpen === true) {
      result[day] = {
        isOpen: true,
        open: typeof schedule.open === 'string' ? schedule.open : '',
        close: typeof schedule.close === 'string' ? schedule.close : '',
      }
    } else {
      result[day] = { isOpen: false }
    }
  }

  return result
}

function isValidTime(value: string): boolean {
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function validateOperatingHours(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') {
    return 'Jam operasional wajib diisi untuk setiap hari.'
  }

  const source = raw as Record<string, unknown>
  let openDayCount = 0

  for (const day of DAY_KEYS) {
    const value = source[day]
    if (!value || typeof value !== 'object') {
      return 'Jam operasional wajib diisi untuk setiap hari.'
    }

    const schedule = value as Record<string, unknown>

    if (typeof schedule.isOpen !== 'boolean') {
      return 'Status buka/tutup setiap hari harus berupa nilai boolean.'
    }

    if (!schedule.isOpen) continue

    if (typeof schedule.open !== 'string' || !isValidTime(schedule.open)) {
      return 'Format jam buka harus HH:mm.'
    }

    if (typeof schedule.close !== 'string' || !isValidTime(schedule.close)) {
      return 'Format jam tutup harus HH:mm.'
    }

    if (timeToMinutes(schedule.open) >= timeToMinutes(schedule.close)) {
      return 'Jam tutup harus lebih lambat dari jam buka.'
    }

    openDayCount += 1
  }

  if (openDayCount === 0) {
    return 'Minimal satu hari harus dibuka.'
  }

  return null
}

export function mapProviderProfileRow(
  row: ProviderProfileRow
): ProviderProfileDto {
  return {
    id: row.profile_id,
    businessName: row.business_name,
    bio: row.bio ?? null,
    whatsappNumber: row.whatsapp_number,
    address: row.address,
    serviceArea: row.service_area,
    operatingHours: normalizeOperatingHours(row.operating_hours),
    primaryCategory: {
      id: row.primary_category_id,
      name: resolveJoinedCategoryName(row),
    },
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const supabaseProviderProfileStore: ProviderProfileStore = {
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

  async findById(profileId: string, accessToken: string) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('provider_profiles')
      .select(PROVIDER_PROFILE_COLUMNS)
      .eq('profile_id', profileId)
      .maybeSingle()

    return {
      data: (data as ProviderProfileRow | null) ?? null,
      error,
    }
  },

  async findPublicById(profileId: string) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient()
    const { data, error } = await client
      .from('provider_profiles')
      .select(PROVIDER_PROFILE_COLUMNS)
      .eq('profile_id', profileId)
      .eq('is_public', true)
      .maybeSingle()

    return {
      data: (data as ProviderProfileRow | null) ?? null,
      error,
    }
  },

  async upsert(
    profileId: string,
    input: ProviderProfileWriteInput,
    accessToken: string
  ) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient(accessToken)
    const { data, error } = await client
      .from('provider_profiles')
      .upsert(
        {
          profile_id: profileId,
          business_name: input.businessName,
          bio: input.bio,
          whatsapp_number: input.whatsappNumber,
          address: input.address,
          service_area: input.serviceArea,
          operating_hours: input.operatingHours,
          primary_category_id: input.primaryCategoryId,
          is_public: input.isPublic,
        },
        { onConflict: 'profile_id' }
      )
      .select(PROVIDER_PROFILE_COLUMNS)
      .single()

    return {
      data: (data as ProviderProfileRow | null) ?? null,
      error,
    }
  },

  async updateById(
    profileId: string,
    input: ProviderProfileUpdateInput,
    accessToken: string
  ) {
    ensureSupabaseConfigured()
    const client = createSupabaseClient(accessToken)

    const payload: Record<string, unknown> = {}
    if (input.businessName !== undefined) payload.business_name = input.businessName
    if (input.bio !== undefined) payload.bio = input.bio
    if (input.whatsappNumber !== undefined) {
      payload.whatsapp_number = input.whatsappNumber
    }
    if (input.address !== undefined) payload.address = input.address
    if (input.serviceArea !== undefined) payload.service_area = input.serviceArea
    if (input.operatingHours !== undefined) {
      payload.operating_hours = input.operatingHours
    }
    if (input.primaryCategoryId !== undefined) {
      payload.primary_category_id = input.primaryCategoryId
    }
    if (input.isPublic !== undefined) payload.is_public = input.isPublic

    const { data, error } = await client
      .from('provider_profiles')
      .update(payload)
      .eq('profile_id', profileId)
      .select(PROVIDER_PROFILE_COLUMNS)
      .maybeSingle()

    return {
      data: (data as ProviderProfileRow | null) ?? null,
      error,
    }
  },
}

let activeProviderProfileStore: ProviderProfileStore =
  supabaseProviderProfileStore

export function setProviderProfileStoreForTesting(
  store: ProviderProfileStore | null
): void {
  activeProviderProfileStore = store ?? supabaseProviderProfileStore
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const { exists, error } = await activeProviderProfileStore.categoryExists(
    categoryId
  )

  if (error) {
    throw mapProviderProfileDatabaseError('verify_category', error)
  }

  if (!exists) {
    throw new AppError(
      400,
      'INVALID_CATEGORY_REFERENCE',
      'Kategori utama yang dipilih tidak ditemukan pada sistem.',
      {
        primaryCategoryId:
          'Kategori utama yang dipilih tidak ditemukan pada sistem.',
      }
    )
  }
}

function normalizeWriteInput(
  input: ProviderProfileWriteInput
): ProviderProfileWriteInput {
  return {
    businessName: normalizeBusinessName(input.businessName),
    bio: input.bio?.trim() ? input.bio.trim() : null,
    whatsappNumber: normalizeWhatsAppNumber(input.whatsappNumber),
    address: input.address.trim(),
    serviceArea: input.serviceArea.trim(),
    operatingHours: normalizeOperatingHours(input.operatingHours),
    primaryCategoryId: input.primaryCategoryId.trim(),
    isPublic: input.isPublic,
  }
}

function normalizeUpdateInput(
  input: ProviderProfileUpdateInput
): ProviderProfileUpdateInput {
  const result: ProviderProfileUpdateInput = {}

  if (input.businessName !== undefined) {
    result.businessName = normalizeBusinessName(input.businessName)
  }
  if (input.bio !== undefined) {
    result.bio = input.bio?.trim() ? input.bio.trim() : null
  }
  if (input.whatsappNumber !== undefined) {
    result.whatsappNumber = normalizeWhatsAppNumber(input.whatsappNumber)
  }
  if (input.address !== undefined) {
    result.address = input.address.trim()
  }
  if (input.serviceArea !== undefined) {
    result.serviceArea = input.serviceArea.trim()
  }
  if (input.operatingHours !== undefined) {
    result.operatingHours = normalizeOperatingHours(input.operatingHours)
  }
  if (input.primaryCategoryId !== undefined) {
    result.primaryCategoryId = input.primaryCategoryId.trim()
  }
  if (input.isPublic !== undefined) {
    result.isPublic = input.isPublic
  }

  return result
}

export async function getMyProviderProfile(
  profileId: string,
  accessToken: string
): Promise<ProviderProfileDto | null> {
  const { data, error } = await activeProviderProfileStore.findById(
    profileId,
    accessToken
  )

  if (error) {
    throw mapProviderProfileDatabaseError('find_own', error)
  }

  return data ? mapProviderProfileRow(data) : null
}

export async function upsertMyProviderProfile(
  profileId: string,
  input: ProviderProfileWriteInput,
  accessToken: string
): Promise<ProviderProfileDto> {
  const normalized = normalizeWriteInput(input)

  await assertCategoryExists(normalized.primaryCategoryId)

  const { data, error } = await activeProviderProfileStore.upsert(
    profileId,
    normalized,
    accessToken
  )

  if (error) {
    throw mapProviderProfileDatabaseError('upsert', error)
  }

  if (!data) {
    throw new AppError(
      502,
      'PROVIDER_PROFILE_ERROR',
      'Profil penyedia gagal disimpan. Silakan coba lagi.'
    )
  }

  return mapProviderProfileRow(data)
}

export async function updateMyProviderProfile(
  profileId: string,
  input: ProviderProfileUpdateInput,
  accessToken: string
): Promise<ProviderProfileDto> {
  const normalized = normalizeUpdateInput(input)

  if (normalized.primaryCategoryId !== undefined) {
    await assertCategoryExists(normalized.primaryCategoryId)
  }

  const { data, error } = await activeProviderProfileStore.updateById(
    profileId,
    normalized,
    accessToken
  )

  if (error) {
    throw mapProviderProfileDatabaseError('update', error)
  }

  if (!data) {
    throw new AppError(
      404,
      'PROVIDER_PROFILE_NOT_FOUND',
      'Profil penyedia belum dibuat.'
    )
  }

  return mapProviderProfileRow(data)
}

export async function getPublicProviderProfile(
  profileId: string
): Promise<ProviderProfileDto> {
  const { data, error } = await activeProviderProfileStore.findPublicById(
    profileId
  )

  if (error) {
    throw mapProviderProfileDatabaseError('find_public', error)
  }

  if (!data) {
    throw new AppError(
      404,
      'PROVIDER_PROFILE_NOT_FOUND',
      'Profil penyedia tidak ditemukan atau belum dipublikasikan.'
    )
  }

  return mapProviderProfileRow(data)
}
