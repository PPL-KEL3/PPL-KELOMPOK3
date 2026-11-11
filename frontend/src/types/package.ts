export const MAX_PACKAGES_PER_SERVICE = 10
export const PACKAGE_PRICE_MIN = 1000
export const PACKAGE_PRICE_MAX = 100000000
export const PACKAGE_NAME_MIN = 3
export const PACKAGE_NAME_MAX = 100
export const PACKAGE_DESCRIPTION_MAX = 500

export interface PackageItem {
  id: string
  serviceId: string
  name: string
  description: string | null
  price: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface PackageFormInput {
  name: string
  description: string
  price: string
  isActive: boolean
}

export interface PackageFormErrors {
  name?: string
  description?: string
  price?: string
  general?: string
}

export type PackageFilter = 'all' | 'active' | 'inactive'
