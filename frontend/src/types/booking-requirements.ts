export interface BookingRequirementPhoto {
  id?: string
  name: string
  size?: number
  url: string
}

export interface BookingRequirementsValue {
  notes: string
  files: File[]
}

export const BOOKING_REQUIREMENTS_NOTES_MAX: number | null = null
