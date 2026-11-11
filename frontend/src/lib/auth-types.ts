export type UserRole = 'customer' | 'provider' | 'admin'
export type ProviderVerificationStatus = 'pending' | 'verified' | 'rejected'

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  providerVerificationStatus: ProviderVerificationStatus | null
  providerRejectionReason: string | null
}

export const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Customer',
  provider: 'Penyedia Jasa',
  admin: 'Administrator',
}

export const VERIFICATION_LABELS: Record<ProviderVerificationStatus, string> = {
  pending: 'Menunggu verifikasi',
  verified: 'Terverifikasi',
  rejected: 'Pengajuan ditolak',
}

export function isUserRole(value: unknown): value is UserRole {
  return value === 'customer' || value === 'provider' || value === 'admin'
}

export function dashboardPathFor(user: AuthUser): string {
  if (user.role === 'customer') return '/customer/dashboard'
  if (user.role === 'admin') return '/admin/dashboard'

  return '/provider/dashboard'
}
