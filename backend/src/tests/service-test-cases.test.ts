import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeServiceName } from '../services/service-listing.service'

export interface ServiceTestCaseSpec {
  id: string
  acceptanceCriteria: 'AC-01' | 'AC-02' | 'AC-03' | 'AC-04' | 'AC-05'
  type: 'positive' | 'negative'
  title: string
  endpoint: string
  expectedStatus: number
  expectedCode?: string
}

export const TPR_128_SERVICE_TEST_CASES: readonly ServiceTestCaseSpec[] = [
  {
    id: 'TC-SVC-01',
    acceptanceCriteria: 'AC-01',
    type: 'positive',
    title: 'Menambahkan layanan jasa baru oleh penyedia jasa terverifikasi',
    endpoint: 'POST /api/services',
    expectedStatus: 201,
  },
  {
    id: 'TC-SVC-02',
    acceptanceCriteria: 'AC-01',
    type: 'negative',
    title: 'Menolak penambahan layanan oleh penyedia jasa yang belum terverifikasi',
    endpoint: 'POST /api/services',
    expectedStatus: 403,
    expectedCode: 'PROVIDER_NOT_VERIFIED',
  },
  {
    id: 'TC-SVC-03',
    acceptanceCriteria: 'AC-02',
    type: 'positive',
    title: 'Pelanggan melihat daftar layanan yang dipublikasikan (is_active = true)',
    endpoint: 'GET /api/services',
    expectedStatus: 200,
  },
  {
    id: 'TC-SVC-04',
    acceptanceCriteria: 'AC-02',
    type: 'positive',
    title: 'Pelanggan memfilter daftar layanan publik berdasarkan kategori',
    endpoint: 'GET /api/services?categoryId=:categoryId',
    expectedStatus: 200,
  },
  {
    id: 'TC-SVC-05',
    acceptanceCriteria: 'AC-02',
    type: 'positive',
    title: 'Penyedia jasa melihat seluruh layanan miliknya sendiri (aktif maupun nonaktif)',
    endpoint: 'GET /api/services/mine',
    expectedStatus: 200,
  },
  {
    id: 'TC-SVC-06',
    acceptanceCriteria: 'AC-03',
    type: 'positive',
    title: 'Penyedia jasa mengubah informasi nama, kategori, deskripsi, dan harga layanan miliknya',
    endpoint: 'PATCH /api/services/:id',
    expectedStatus: 200,
  },
  {
    id: 'TC-SVC-07',
    acceptanceCriteria: 'AC-03',
    type: 'negative',
    title: 'Menolak perubahan layanan jika ID layanan tidak terdaftar di database',
    endpoint: 'PATCH /api/services/:id',
    expectedStatus: 404,
    expectedCode: 'SERVICE_NOT_FOUND',
  },
  {
    id: 'TC-SVC-08',
    acceptanceCriteria: 'AC-04',
    type: 'positive',
    title: 'Penyedia jasa menonaktifkan layanan miliknya (isActive = false)',
    endpoint: 'PATCH /api/services/:id',
    expectedStatus: 200,
  },
  {
    id: 'TC-SVC-09',
    acceptanceCriteria: 'AC-04',
    type: 'positive',
    title: 'Penyedia jasa menghapus permanen layanan miliknya yang tidak lagi ditawarkan',
    endpoint: 'DELETE /api/services/:id',
    expectedStatus: 200,
  },
  {
    id: 'TC-SVC-10',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Menolak penyimpanan layanan dengan data wajib kosong (nama, kategori, deskripsi, harga)',
    endpoint: 'POST /api/services',
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
  {
    id: 'TC-SVC-11',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Menolak harga layanan yang kurang dari Rp 1.000 atau bukan angka bulat',
    endpoint: 'POST /api/services',
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
  {
    id: 'TC-SVC-12',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Menolak penambahan layanan jika categoryId tidak terdaftar di tabel kategori',
    endpoint: 'POST /api/services',
    expectedStatus: 400,
    expectedCode: 'INVALID_CATEGORY_REFERENCE',
  },
  {
    id: 'TC-SVC-13',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Mencegah Penyedia B mengubah atau menonaktifkan layanan milik Penyedia A',
    endpoint: 'PATCH /api/services/:id',
    expectedStatus: 403,
    expectedCode: 'SERVICE_OWNERSHIP_FORBIDDEN',
  },
  {
    id: 'TC-SVC-14',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Mencegah Penyedia B menghapus layanan milik Penyedia A',
    endpoint: 'DELETE /api/services/:id',
    expectedStatus: 403,
    expectedCode: 'SERVICE_OWNERSHIP_FORBIDDEN',
  },
  {
    id: 'TC-SVC-15',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Menolak operasi pengelolaan layanan oleh pengguna tanpa sesi login atau ber-role customer',
    endpoint: 'POST /api/services',
    expectedStatus: 403,
    expectedCode: 'FORBIDDEN',
  },
]

describe('TPR-2 / TPR-128: Penyusunan Test Case Pengelolaan Daftar Layanan Jasa', () => {
  it('Memiliki 15 skenario test case terstruktur (TC-SVC-01 s.d. TC-SVC-15) dengan ID unik', () => {
    assert.equal(TPR_128_SERVICE_TEST_CASES.length, 15)

    const ids = TPR_128_SERVICE_TEST_CASES.map((tc) => tc.id)
    const uniqueIds = new Set(ids)
    assert.equal(uniqueIds.size, 15)
    assert.equal(ids[0], 'TC-SVC-01')
    assert.equal(ids[14], 'TC-SVC-15')
  })

  it('Mencakup seluruh 5 Acceptance Criteria TPR-2 (AC-01 s.d. AC-05)', () => {
    const coveredCriteria = new Set(
      TPR_128_SERVICE_TEST_CASES.map((tc) => tc.acceptanceCriteria)
    )

    assert.deepEqual(
      Array.from(coveredCriteria).sort(),
      ['AC-01', 'AC-02', 'AC-03', 'AC-04', 'AC-05']
    )
  })

  it('Mencakup kombinasi skenario positif (7 alur utama) dan negatif (8 validasi & otorisasi)', () => {
    const positiveCases = TPR_128_SERVICE_TEST_CASES.filter(
      (tc) => tc.type === 'positive'
    )
    const negativeCases = TPR_128_SERVICE_TEST_CASES.filter(
      (tc) => tc.type === 'negative'
    )

    assert.equal(positiveCases.length, 7)
    assert.equal(negativeCases.length, 8)
  })

  it('Memverifikasi fungsi normalisasi spasi nama layanan pada data uji (normalizeServiceName)', () => {
    const rawName = '   Servis   AC   Split & Cuci Unit  '
    assert.equal(normalizeServiceName(rawName), 'Servis AC Split & Cuci Unit')
  })
})

