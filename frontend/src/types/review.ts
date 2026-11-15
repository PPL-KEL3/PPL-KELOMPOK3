export interface ReviewItem {
  id: string
  bookingId: string
  customerId: string
  customerName: string
  providerId: string
  serviceId: string
  serviceName: string
  rating: number
  comment: string
  editCount: number
  isEdited: boolean
  createdAt: string
  updatedAt: string
}

export interface ProviderReviewStats {
  averageRating: number
  totalReviews: number
  ratingDistribution: {
    1: number
    2: number
    3: number
    4: number
    5: number
  }
}

export interface CreateReviewPayload {
  bookingId: string
  rating: number
  comment: string
}

export interface UpdateReviewPayload {
  rating?: number
  comment?: string
}
