import type { Category } from '@/types/category'

/**
 * Mock data lokal untuk demonstrasi antarmuka TPR-25 (Category Management UI).
 * Data ini bersifat sementara di memori browser dan akan digantikan oleh
 * integrasi REST API Express + Supabase pada subtask TPR-26.
 */
export const INITIAL_MOCK_CATEGORIES: Category[] = [
  {
    id: 'cat-001',
    name: 'Perbaikan & Pertukangan Rumah',
    description:
      'Layanan perbaikan atap, pengecatan dinding, instalasi pintu/jendela, serta pertukangan kayu dan bangunan rumah tangga.',
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 'cat-002',
    name: 'Kebersihan & Perawatan Hunian',
    description:
      'Jasa pembersihan rumah harian, cuci sofa dan kasur, pemangkasan rumput taman, serta sanitasi ruangan.',
    createdAt: '2026-11-02T09:15:00.000Z',
    updatedAt: '2026-11-02T09:15:00.000Z',
  },
  {
    id: 'cat-003',
    name: 'Servis Elektronik & AC',
    description:
      'Cuci dan isi freon AC, perbaikan kulkas, mesin cuci, televisi, pompa air, serta instalasi kelistrikan ringan.',
    createdAt: '2026-11-03T10:30:00.000Z',
    updatedAt: '2026-11-03T10:30:00.000Z',
  },
  {
    id: 'cat-004',
    name: 'Jahit & Permak Pakaian',
    description:
      'Layanan obras, kecilkan ukuran celana/kemeja, ganti ritsleting, hingga pembuatan busana harian oleh penjahit lokal.',
    createdAt: '2026-11-04T13:20:00.000Z',
    updatedAt: '2026-11-04T13:20:00.000Z',
  },
  {
    id: 'cat-005',
    name: 'Katering & Kuliner Rumahan',
    description:
      'Penyediaan nasi kotak, tumpeng, kue tradisional, dan katering harian dari pelaku usaha kuliner lokal.',
    createdAt: '2026-11-05T14:45:00.000Z',
    updatedAt: '2026-11-05T14:45:00.000Z',
  },
]

