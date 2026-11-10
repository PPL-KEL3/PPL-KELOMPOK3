import type { ServiceItem } from '@/types/service'

export const DEFAULT_DEMO_PROVIDER_ID = 'provider-demo-001'

export const INITIAL_MOCK_SERVICES: ServiceItem[] = [
  {
    id: 'svc-001',
    providerId: DEFAULT_DEMO_PROVIDER_ID,
    providerName: 'Bengkel Bangunan Pak Rahmat',
    categoryId: 'cat-001',
    categoryName: 'Perbaikan & Pertukangan Rumah',
    name: 'Perbaikan Kebocoran Atap & Talang Air',
    description:
      'Pemeriksaan titik rembesan atap genteng atau seng, penggantian genteng pecah, pelapisan ulang waterproofing, dan pembersihan jalur talang air rumah.',
    price: 150000,
    isActive: true,
    createdAt: '2026-11-06T08:30:00.000Z',
    updatedAt: '2026-11-06T08:30:00.000Z',
  },
  {
    id: 'svc-002',
    providerId: DEFAULT_DEMO_PROVIDER_ID,
    providerName: 'Bengkel Bangunan Pak Rahmat',
    categoryId: 'cat-003',
    categoryName: 'Servis Elektronik & AC',
    name: 'Cuci AC Split & Pengecekan Tekanan Freon',
    description:
      'Pembersihan unit indoor dan outdoor AC split 0.5 hingga 2 PK, pembersihan saluran pembuangan air, serta pengecekan tekanan freon dan arus listrik.',
    price: 85000,
    isActive: true,
    createdAt: '2026-11-07T09:15:00.000Z',
    updatedAt: '2026-11-07T09:15:00.000Z',
  },
  {
    id: 'svc-003',
    providerId: DEFAULT_DEMO_PROVIDER_ID,
    providerName: 'Bengkel Bangunan Pak Rahmat',
    categoryId: 'cat-001',
    categoryName: 'Perbaikan & Pertukangan Rumah',
    name: 'Pengecatan Ulang Dinding Kamar & Ruang Tamu',
    description:
      'Pengerjaan amplas dinding lama, pendempulan retak rambut, dan pengecatan 2 lapis untuk area interior rumah (belum termasuk bahan cat utama).',
    price: 250000,
    isActive: false,
    createdAt: '2026-11-08T11:00:00.000Z',
    updatedAt: '2026-11-08T11:00:00.000Z',
  },
]

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}

