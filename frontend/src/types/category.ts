export interface Category {
  id: string
  name: string
  description: string | null
  usageCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface CategoryFormInput {
  name: string
  description: string
}

export interface CategoryFormErrors {
  name?: string
  description?: string
  general?: string
}

