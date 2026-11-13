import type { PackageItem } from '@/types/package'
import type { ProviderProfile } from '@/types/provider'
import type { ServiceItem } from '@/types/service'

export interface BookingDraft {
  serviceId: string
  providerId: string
  packageId: string
  workDate: string
  workTime: string
}

export interface BookingSummaryData extends BookingDraft {
  service: ServiceItem
  provider: ProviderProfile
  selectedPackage: PackageItem | null
}

/** Bentuk data detail generik untuk dipetakan ke response TPR-74 nantinya. */
export interface BookingDetailData {
  id: string
  status: string
  customerId: string
  providerId: string
  serviceId: string
  packageId: string | null
  serviceName: string
  providerName: string
  customerName?: string
  packageName: string | null
  workDate: string
  workTime: string
  price: number
  cancellationReason: string | null
  createdAt: string
  updatedAt: string
}
