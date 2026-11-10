export const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type DayKey = (typeof DAY_KEYS)[number]

export const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Senin',
  tuesday: 'Selasa',
  wednesday: 'Rabu',
  thursday: 'Kamis',
  friday: 'Jumat',
  saturday: 'Sabtu',
  sunday: 'Minggu',
}

export interface DaySchedule {
  isOpen: boolean
  open?: string
  close?: string
}

export type OperatingHours = Record<DayKey, DaySchedule>

export interface ProviderCategory {
  id: string
  name: string
}

export interface ProviderProfile {
  id: string
  businessName: string
  bio: string | null
  whatsappNumber: string
  address: string
  serviceArea: string
  operatingHours: OperatingHours
  primaryCategory: ProviderCategory
  isPublic: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ProviderProfileFormInput {
  businessName: string
  bio: string
  whatsappNumber: string
  address: string
  serviceArea: string
  operatingHours: OperatingHours
  primaryCategoryId: string
  isPublic: boolean
}

export interface ProviderProfileFormErrors {
  businessName?: string
  bio?: string
  whatsappNumber?: string
  address?: string
  serviceArea?: string
  operatingHours?: string
  primaryCategoryId?: string
  isPublic?: string
  general?: string
}
