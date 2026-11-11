import type { AuthUser } from './auth-types'
import type { Category } from '@/types/category'
import type {
  OperatingHours,
  ProviderProfile,
  ServiceArea,
} from '@/types/provider'
import type { PackageItem } from '@/types/package'
import type { PortfolioContentType, PortfolioItem } from '@/types/portfolio'
import type { ServiceItem } from '@/types/service'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

interface ApiSuccess<T> {
  success: true
  data: T
}

interface ApiFailure {
  success: false
  error: {
    code?: string
    message?: string
    fields?: Record<string, string>
  }
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const hasBody = options.body !== undefined

  let response: Response

  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      ...options,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers ?? {}),
      },
    })
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Tidak dapat terhubung ke server. Coba lagi.'
    )
  }

  const text = await response.text()
  let payload: ApiSuccess<T> | ApiFailure | null = null

  if (text) {
    try {
      payload = JSON.parse(text) as ApiSuccess<T> | ApiFailure
    } catch {
      payload = null
    }
  }

  if (!response.ok || !payload || payload.success === false) {
    const failure = payload && payload.success === false ? payload : null
    throw new ApiError(
      response.status,
      failure?.error.code ?? 'REQUEST_FAILED',
      failure?.error.message ?? 'Terjadi kesalahan. Silakan coba lagi.',
      failure?.error.fields
    )
  }

  return payload.data
}

export interface LoginInput {
  email: string
  password: string
  remember: boolean
}

export interface LoginResult {
  user: AuthUser
  redirectTo: string
}

export interface RegisterInput {
  fullName: string
  email: string
  password: string
  role: 'customer' | 'provider'
}

export interface RegisterResult {
  user: AuthUser | null
  redirectTo: string | null
  requiresEmailConfirmation: boolean
  message: string
}

export interface MeResult {
  user: AuthUser
  redirectTo: string
}

export interface MessageResult {
  message: string
}

export interface ResetPasswordInput {
  password: string
  tokenHash?: string
  accessToken?: string
  refreshToken?: string
  code?: string
}

export interface VerificationResult {
  user: AuthUser
  redirectTo: string
  message: string
}

export const authApi = {
  login(input: LoginInput) {
    return request<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  register(input: RegisterInput) {
    return request<RegisterResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  me() {
    return request<MeResult>('/auth/me')
  },

  logout() {
    return request<{ loggedOut: boolean }>('/auth/logout', {
      method: 'POST',
    })
  },

  forgotPassword(email: string) {
    return request<MessageResult>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  resetPassword(input: ResetPasswordInput) {
    return request<MessageResult>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  requestProviderVerification() {
    return request<VerificationResult>('/provider/request-verification', {
      method: 'POST',
    })
  },
}

export interface CategoryListResult {
  categories: Category[]
}

export interface CategoryItemResult {
  category: Category
  message?: string
}

export interface CategoryDeleteApiResult {
  category: Category
  deletedId: string
  message: string
}

export interface CategoryMutationPayload {
  name: string
  description: string | null
}

export const categoryApi = {
  list() {
    return request<CategoryListResult>('/categories')
  },

  getById(id: string) {
    return request<{ category: Category }>(
      `/categories/${encodeURIComponent(id)}`
    )
  },

  create(input: CategoryMutationPayload) {
    return request<CategoryItemResult>('/categories', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  update(id: string, input: Partial<CategoryMutationPayload>) {
    return request<CategoryItemResult>(
      `/categories/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      }
    )
  },

  remove(id: string) {
    return request<CategoryDeleteApiResult>(
      `/categories/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    )
  },
}

export interface ServiceListResult {
  services: ServiceItem[]
}

export interface ServiceItemResult {
  service: ServiceItem
  message?: string
}

export interface ServiceDeleteApiResult {
  service: ServiceItem
  deletedId: string
  message: string
}

export interface ServiceMutationPayload {
  categoryId: string
  name: string
  description: string
  price: number
  isActive: boolean
}

export const serviceApi = {
  listPublic(categoryId?: string) {
    const query = categoryId
      ? `?categoryId=${encodeURIComponent(categoryId)}`
      : ''
    return request<ServiceListResult>(`/services${query}`)
  },

  listMine() {
    return request<ServiceListResult>('/services/mine')
  },

  getById(id: string) {
    return request<{ service: ServiceItem }>(
      `/services/${encodeURIComponent(id)}`
    )
  },

  create(input: ServiceMutationPayload) {
    return request<ServiceItemResult>('/services', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  update(id: string, input: Partial<ServiceMutationPayload>) {
    return request<ServiceItemResult>(
      `/services/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      }
    )
  },

  remove(id: string) {
    return request<ServiceDeleteApiResult>(
      `/services/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    )
  },
}

export interface PackageListResult {
  packages: PackageItem[]
}

export interface PackageItemResult {
  package: PackageItem
  message?: string
}

export interface PackageDeleteApiResult {
  package: PackageItem
  deletedId: string
  message: string
}

export interface PackageMutationPayload {
  serviceId: string
  name: string
  description: string | null
  price: number
  isActive: boolean
}

export const packageApi = {
  listByService(serviceId: string) {
    return request<PackageListResult>(
      `/services/${encodeURIComponent(serviceId)}/packages`
    )
  },

  listMine(serviceId: string) {
    return request<PackageListResult>(
      `/packages/mine?serviceId=${encodeURIComponent(serviceId)}`
    )
  },

  create(input: PackageMutationPayload) {
    return request<PackageItemResult>('/packages', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  update(id: string, input: Partial<Omit<PackageMutationPayload, 'serviceId'>>) {
    return request<PackageItemResult>(
      `/packages/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      }
    )
  },

  remove(id: string) {
    return request<PackageDeleteApiResult>(
      `/packages/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    )
  },
}

export interface ProviderProfilePayload {
  businessName: string
  bio: string | null
  whatsappNumber: string
  address: string
  serviceArea: string
  operatingHours: OperatingHours
  primaryCategoryId: string
  isPublic: boolean
}

export interface ProviderProfileResult {
  profile: ProviderProfile | null
  message?: string
}

export interface PublicProviderResult {
  provider: ProviderProfile
  services: ServiceItem[]
}

export const providerProfileApi = {
  getMine() {
    return request<ProviderProfileResult>('/providers/me')
  },

  upsertMine(input: ProviderProfilePayload) {
    return request<ProviderProfileResult>('/providers/me', {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  },

  updateMine(input: Partial<ProviderProfilePayload>) {
    return request<ProviderProfileResult>('/providers/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  getPublic(providerId: string) {
    return request<PublicProviderResult>(
      `/providers/${encodeURIComponent(providerId)}`
    )
  },
}

export interface ServiceAreaListResult {
  serviceAreas: ServiceArea[]
}

export interface ServiceAreaMutationApiResult {
  serviceArea: ServiceArea
  serviceAreas: ServiceArea[]
  message: string
}

export interface ServiceAreaPayload {
  areaName: string
  radiusKm: number
}

export const serviceAreaApi = {
  listMine() {
    return request<ServiceAreaListResult>('/providers/me/service-areas')
  },

  create(input: ServiceAreaPayload) {
    return request<ServiceAreaMutationApiResult>(
      '/providers/me/service-areas',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    )
  },

  update(areaId: string, input: Partial<ServiceAreaPayload>) {
    return request<ServiceAreaMutationApiResult>(
      `/providers/me/service-areas/${encodeURIComponent(areaId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      }
    )
  },

  remove(areaId: string) {
    return request<ServiceAreaMutationApiResult>(
      `/providers/me/service-areas/${encodeURIComponent(areaId)}`,
      {
        method: 'DELETE',
      }
    )
  },
}

export interface PortfolioListResult {
  items: PortfolioItem[]
}

export interface PortfolioMineResult {
  items: PortfolioItem[]
  total: number
  limit: number
  remainingSlots: number
}

export interface PortfolioUploadUrlPayload {
  fileName: string
  contentType: PortfolioContentType
  size: number
}

export interface PortfolioUploadUrlResult {
  uploadUrl: string
  imagePath: string
}

export interface PortfolioItemResult {
  item: PortfolioItem
  message?: string
}

export interface PortfolioDeleteApiResult {
  deletedId: string
  fileCleanupFailed: boolean
  message: string
}

export interface PortfolioCreatePayload {
  title: string
  description: string | null
  imagePath: string
}

export type PortfolioUpdatePayload = Partial<PortfolioCreatePayload>

async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  let response: Response

  try {
    response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
  } catch {
    throw new ApiError(
      0,
      'UPLOAD_FAILED',
      'Foto gagal diunggah. Periksa koneksi lalu coba lagi.'
    )
  }

  if (response.ok) return

  const text = await response.text().catch(() => '')
  const tooLarge =
    response.status === 413 || /413|too large|exceeded/i.test(text)
  const invalidType = /mime|content.?type/i.test(text)

  if (tooLarge) {
    throw new ApiError(
      response.status,
      'FILE_TOO_LARGE',
      'Ukuran foto melebihi 5 MB.'
    )
  }

  if (invalidType) {
    throw new ApiError(
      response.status,
      'INVALID_FILE_TYPE',
      'Format foto harus JPG atau PNG.'
    )
  }

  throw new ApiError(
    response.status,
    'UPLOAD_FAILED',
    'Foto gagal diunggah. Coba lagi.'
  )
}

export const portfolioApi = {
  listMine() {
    return request<PortfolioMineResult>('/providers/me/portfolio')
  },

  listByProvider(providerId: string) {
    return request<PortfolioListResult>(
      `/providers/${encodeURIComponent(providerId)}/portfolio`
    )
  },

  requestUploadUrl(input: PortfolioUploadUrlPayload) {
    return request<PortfolioUploadUrlResult>(
      '/providers/me/portfolio/upload-url',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    )
  },

  uploadFile(uploadUrl: string, file: File) {
    return uploadToSignedUrl(uploadUrl, file)
  },

  create(input: PortfolioCreatePayload) {
    return request<PortfolioItemResult>('/providers/me/portfolio', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  update(id: string, input: PortfolioUpdatePayload) {
    return request<PortfolioItemResult>(
      `/providers/me/portfolio/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      }
    )
  },

  remove(id: string) {
    return request<PortfolioDeleteApiResult>(
      `/providers/me/portfolio/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    )
  },
}
