import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MAX_PACKAGES_PER_SERVICE } from '../services/package.service'

// Spesifikasi test case TPR-5 (TPR-129). Sumber: docs/test-cases/TPR-5-service-package-pricing.md
export interface PackageTestCaseSpec {
  id: string
  acceptanceCriteria: 'AC-01' | 'AC-02' | 'AC-03' | 'AC-04' | 'AC-05' | 'AC-06' | 'AC-07' | 'AC-08' | 'AC-09'
  type: 'positive' | 'negative'
  title: string
  endpoint: string
  expectedStatus: number
  expectedCode?: string
}

export const TPR_129_PACKAGE_TEST_CASES: readonly PackageTestCaseSpec[] = [
  {
    id: 'TC-PKG-01',
    acceptanceCriteria: 'AC-01',
    type: 'positive',
    title: 'Penyedia menambah paket aktif ke jasa miliknya',
    endpoint: 'POST /api/packages',
    expectedStatus: 201,
  },
  {
    id: 'TC-PKG-02',
    acceptanceCriteria: 'AC-01',
    type: 'positive',
    title: 'Penyedia menambah paket nonaktif dengan deskripsi kosong',
    endpoint: 'POST /api/packages',
    expectedStatus: 201,
  },
  {
    id: 'TC-PKG-03',
    acceptanceCriteria: 'AC-01',
    type: 'positive',
    title: 'Penyedia melihat seluruh paket jasanya (aktif + nonaktif, tanpa yang dihapus)',
    endpoint: 'GET /api/packages/mine?serviceId=:serviceId',
    expectedStatus: 200,
  },
  {
    id: 'TC-PKG-04',
    acceptanceCriteria: 'AC-02',
    type: 'positive',
    title: 'Pengunjung tanpa login melihat paket aktif suatu jasa, urut harga termurah',
    endpoint: 'GET /api/services/:serviceId/packages',
    expectedStatus: 200,
  },
  {
    id: 'TC-PKG-05',
    acceptanceCriteria: 'AC-02',
    type: 'positive',
    title: 'Jasa aktif yang belum punya paket aktif mengembalikan daftar kosong',
    endpoint: 'GET /api/services/:serviceId/packages',
    expectedStatus: 200,
  },
  {
    id: 'TC-PKG-06',
    acceptanceCriteria: 'AC-02',
    type: 'negative',
    title: 'Jasa nonaktif atau tidak terdaftar tidak bisa dilihat publik',
    endpoint: 'GET /api/services/:serviceId/packages',
    expectedStatus: 404,
    expectedCode: 'SERVICE_NOT_FOUND',
  },
  {
    id: 'TC-PKG-07',
    acceptanceCriteria: 'AC-02',
    type: 'negative',
    title: 'Menolak ID jasa yang bukan UUID pada endpoint publik',
    endpoint: 'GET /api/services/:serviceId/packages',
    expectedStatus: 400,
    expectedCode: 'INVALID_SERVICE_ID',
  },
  {
    id: 'TC-PKG-08',
    acceptanceCriteria: 'AC-03',
    type: 'positive',
    title: 'Penyedia mengubah nama, deskripsi, dan harga paket miliknya',
    endpoint: 'PATCH /api/packages/:id',
    expectedStatus: 200,
  },
  {
    id: 'TC-PKG-09',
    acceptanceCriteria: 'AC-03',
    type: 'negative',
    title: 'Menolak perubahan paket yang tidak terdaftar',
    endpoint: 'PATCH /api/packages/:id',
    expectedStatus: 404,
    expectedCode: 'PACKAGE_NOT_FOUND',
  },
  {
    id: 'TC-PKG-10',
    acceptanceCriteria: 'AC-03',
    type: 'positive',
    title: 'Modal Edit terisi data lama dan konfirmasi buang perubahan (UI)',
    endpoint: 'UI /provider/dashboard/packages',
    expectedStatus: 200,
  },
  {
    id: 'TC-PKG-11',
    acceptanceCriteria: 'AC-04',
    type: 'positive',
    title: 'Penyedia menonaktifkan paket tanpa dialog; paket tidak tampil publik',
    endpoint: 'PATCH /api/packages/:id',
    expectedStatus: 200,
  },
  {
    id: 'TC-PKG-12',
    acceptanceCriteria: 'AC-04',
    type: 'positive',
    title: 'Penyedia mengaktifkan lagi paket nonaktif',
    endpoint: 'PATCH /api/packages/:id',
    expectedStatus: 200,
  },
  {
    id: 'TC-PKG-13',
    acceptanceCriteria: 'AC-05',
    type: 'positive',
    title: 'Penyedia menghapus paket (soft delete) lewat dialog konfirmasi',
    endpoint: 'DELETE /api/packages/:id',
    expectedStatus: 200,
  },
  {
    id: 'TC-PKG-14',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Menolak penghapusan paket yang sudah dihapus atau tidak terdaftar',
    endpoint: 'DELETE /api/packages/:id',
    expectedStatus: 404,
    expectedCode: 'PACKAGE_NOT_FOUND',
  },
  {
    id: 'TC-PKG-15',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Menolak hapus permanen jasa yang masih punya paket',
    endpoint: 'DELETE /api/services/:id',
    expectedStatus: 409,
    expectedCode: 'SERVICE_HAS_PACKAGES',
  },
  {
    id: 'TC-PKG-16',
    acceptanceCriteria: 'AC-06',
    type: 'negative',
    title: 'Menolak nama paket kosong, kurang dari 3, atau lebih dari 100 karakter',
    endpoint: 'POST /api/packages',
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
  {
    id: 'TC-PKG-17',
    acceptanceCriteria: 'AC-06',
    type: 'negative',
    title: 'Menolak harga kosong, di luar Rp 1.000 - Rp 100.000.000, atau bukan bilangan bulat',
    endpoint: 'POST /api/packages',
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
  {
    id: 'TC-PKG-18',
    acceptanceCriteria: 'AC-06',
    type: 'negative',
    title: 'Menolak deskripsi lebih dari 500 karakter',
    endpoint: 'POST /api/packages',
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
  {
    id: 'TC-PKG-19',
    acceptanceCriteria: 'AC-06',
    type: 'negative',
    title: 'Menolak nama paket yang sudah dipakai di jasa yang sama',
    endpoint: 'POST /api/packages',
    expectedStatus: 409,
    expectedCode: 'DUPLICATE_PACKAGE_NAME',
  },
  {
    id: 'TC-PKG-20',
    acceptanceCriteria: 'AC-06',
    type: 'negative',
    title: 'Menolak paket ke-11 dalam satu jasa',
    endpoint: 'POST /api/packages',
    expectedStatus: 409,
    expectedCode: 'PACKAGE_LIMIT_REACHED',
  },
  {
    id: 'TC-PKG-21',
    acceptanceCriteria: 'AC-07',
    type: 'negative',
    title: 'Menolak operasi tulis paket tanpa sesi login atau dengan role customer',
    endpoint: 'POST /api/packages',
    expectedStatus: 403,
    expectedCode: 'FORBIDDEN',
  },
  {
    id: 'TC-PKG-22',
    acceptanceCriteria: 'AC-07',
    type: 'negative',
    title: 'Mencegah Penyedia B menambah paket ke jasa milik Penyedia A',
    endpoint: 'POST /api/packages',
    expectedStatus: 403,
    expectedCode: 'PACKAGE_OWNERSHIP_FORBIDDEN',
  },
  {
    id: 'TC-PKG-23',
    acceptanceCriteria: 'AC-07',
    type: 'negative',
    title: 'Mencegah Penyedia B mengubah atau menghapus paket milik Penyedia A',
    endpoint: 'PATCH /api/packages/:id',
    expectedStatus: 403,
    expectedCode: 'PACKAGE_OWNERSHIP_FORBIDDEN',
  },
  {
    id: 'TC-PKG-24',
    acceptanceCriteria: 'AC-07',
    type: 'negative',
    title: 'Cek RLS per peran di Supabase pribadi (anon, Penyedia A, Penyedia B)',
    endpoint: 'SQL public.service_packages',
    expectedStatus: 403,
  },
  {
    id: 'TC-PKG-25',
    acceptanceCriteria: 'AC-08',
    type: 'positive',
    title: 'Chip ringkasan dan filter Semua / Aktif / Nonaktif disaring di sisi klien (UI)',
    endpoint: 'UI /provider/dashboard/packages',
    expectedStatus: 200,
  },
  {
    id: 'TC-PKG-26',
    acceptanceCriteria: 'AC-09',
    type: 'positive',
    title: 'Menu Paket & Harga tampil dan aktif di sidebar penyedia (UI)',
    endpoint: 'UI /provider/dashboard/packages',
    expectedStatus: 200,
  },
]

describe('TPR-5 / TPR-129: Penyusunan Test Case Paket & Harga Layanan', () => {
  it('Memiliki 26 skenario test case terstruktur (TC-PKG-01 s.d. TC-PKG-26) dengan ID unik dan berurutan', () => {
    assert.equal(TPR_129_PACKAGE_TEST_CASES.length, 26)
    const ids = TPR_129_PACKAGE_TEST_CASES.map((tc) => tc.id)
    assert.equal(new Set(ids).size, 26)
    ids.forEach((id, index) => {
      assert.equal(id, `TC-PKG-${String(index + 1).padStart(2, '0')}`)
    })
  })

  it('Mencakup seluruh 9 Acceptance Criteria TPR-5 (AC-01 s.d. AC-09)', () => {
    const covered = new Set(TPR_129_PACKAGE_TEST_CASES.map((tc) => tc.acceptanceCriteria))
    assert.deepEqual(Array.from(covered).sort(), ['AC-01', 'AC-02', 'AC-03', 'AC-04', 'AC-05', 'AC-06', 'AC-07', 'AC-08', 'AC-09'])
  })

  it('Mencakup kombinasi skenario positif (12 alur utama) dan negatif (14 validasi & otorisasi)', () => {
    const positive = TPR_129_PACKAGE_TEST_CASES.filter((tc) => tc.type === 'positive')
    const negative = TPR_129_PACKAGE_TEST_CASES.filter((tc) => tc.type === 'negative')
    assert.equal(positive.length, 12)
    assert.equal(negative.length, 14)
  })

  it('Batas paket per jasa pada data uji sama dengan aturan backend (10 paket)', () => {
    assert.equal(MAX_PACKAGES_PER_SERVICE, 10)
  })
})
