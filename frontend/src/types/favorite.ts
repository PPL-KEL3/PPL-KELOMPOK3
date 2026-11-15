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

export interface FavoriteItem {
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

export interface CreateFavoritePayload {
  itemType: FavoriteItemType
  serviceId?: string | null
  providerId?: string | null
  label?: string | null
  notes?: string | null
}

export interface UpdateFavoritePayload {
  label?: string | null
  notes?: string | null
}
