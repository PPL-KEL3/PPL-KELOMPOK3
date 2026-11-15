export const PORTFOLIO_MAX_ITEMS = 20
export const PORTFOLIO_MAX_FILE_SIZE = 5 * 1024 * 1024
export const PORTFOLIO_ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png'] as const
export const PORTFOLIO_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'] as const
export const PORTFOLIO_TITLE_MIN = 3
export const PORTFOLIO_TITLE_MAX = 100
export const PORTFOLIO_DESCRIPTION_MAX = 500

export type PortfolioContentType =
  (typeof PORTFOLIO_ALLOWED_CONTENT_TYPES)[number]

export interface PortfolioItem {
  id: string
  providerId: string
  title: string
  description: string | null
  imageUrl: string
  imagePath: string
  createdAt: string
  updatedAt: string
}

export interface PortfolioFormInput {
  title: string
  description: string
}

export interface PortfolioFormErrors {
  file?: string
  title?: string
  description?: string
  general?: string
}
