export interface ServiceItem {
  id: string
  providerId: string
  providerName?: string
  categoryId: string
  categoryName: string
  name: string
  description: string
  price: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ServiceFormInput {
  name: string
  categoryId: string
  description: string
  price: string
  isActive: boolean
}

export interface ServiceFormErrors {
  name?: string
  categoryId?: string
  description?: string
  price?: string
  general?: string
}

