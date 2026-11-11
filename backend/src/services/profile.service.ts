import { createSupabaseClient } from '../config/supabase'
import { AppError } from '../lib/errors'

export type UserRole = 'customer' | 'provider' | 'admin'
export type ProviderVerificationStatus = 'pending' | 'verified' | 'rejected'

export interface AuthProfile {
  id: string
  email: string
  fullName: string
  role: UserRole
  providerVerificationStatus: ProviderVerificationStatus | null
  providerRejectionReason: string | null
}

interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
  provider_verification_status: string | null
  provider_rejection_reason: string | null
}

const APP_ROLES: readonly UserRole[] = ['customer', 'provider', 'admin']
const PROVIDER_STATUSES: readonly ProviderVerificationStatus[] = [
  'pending',
  'verified',
  'rejected',
]

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && APP_ROLES.includes(value as UserRole)
}

function isProviderStatus(value: unknown): value is ProviderVerificationStatus {
  return typeof value === 'string' && PROVIDER_STATUSES.includes(value as ProviderVerificationStatus)
}

/**
 * Loads the role from the `profiles` table. The role is never taken from the
 * request body, localStorage, or user-editable auth metadata.
 */
export async function getProfileForUser(
  userId: string,
  accessToken: string,
  fallbackEmail = ''
): Promise<AuthProfile> {
  const client = createSupabaseClient(accessToken)
  const { data, error } = await client
    .from('profiles')
    .select(
      'id, email, full_name, role, provider_verification_status, provider_rejection_reason'
    )
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[auth] Failed to load profile', { code: error.code })
    throw new AppError(
      503,
      'PROFILE_UNAVAILABLE',
      'Layanan profil belum siap. Silakan coba lagi nanti.'
    )
  }

  if (!data) {
    console.error('[auth] Authenticated user has no LOKA profile row')
    throw new AppError(
      403,
      'PROFILE_MISSING',
      'Akun kamu belum memiliki profil LOKA. Hubungi dukungan LOKA.'
    )
  }

  const row = data as ProfileRow

  if (!isUserRole(row.role)) {
    console.error('[auth] Account has an unrecognized role', { role: row.role })
    throw new AppError(
      403,
      'INVALID_ROLE',
      'Akun ini tidak memiliki role yang valid untuk mengakses LOKA.'
    )
  }

  const providerVerificationStatus = row.role === 'provider' ? 'verified' : null

  const email = row.email || fallbackEmail
  const fullName = row.full_name?.trim() || email.split('@')[0] || 'Pengguna LOKA'

  return {
    id: row.id,
    email,
    fullName,
    role: row.role,
    providerVerificationStatus,
    providerRejectionReason:
      row.role === 'provider' ? row.provider_rejection_reason : null,
  }
}

export function redirectPathFor(profile: AuthProfile): string {
  switch (profile.role) {
    case 'customer':
      return '/customer/dashboard'
    case 'admin':
      return '/admin/dashboard'
    case 'provider':
      return '/provider/dashboard'
    default:
      throw new AppError(
        403,
        'INVALID_ROLE',
        'Akun ini tidak memiliki role yang valid untuk mengakses LOKA.'
      )
  }
}
