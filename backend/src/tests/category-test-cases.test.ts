import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeCategoryName } from '../services/category.service'

export interface CategoryTestCaseSpec {
  id: string
  acceptanceCriteria: 'AC-01' | 'AC-02' | 'AC-03' | 'AC-04' | 'AC-05'
  type: 'positive' | 'negative'
  title: string
  endpoint: string
  expectedStatus: number
  expectedCode?: string
}

export const TPR_127_CATEGORY_TEST_CASES: readonly CategoryTestCaseSpec[] = [
  {
    id: 'TC-CAT-01',
    acceptanceCriteria: 'AC-01',
    type: 'positive',
    title: 'Menambahkan kategori baru dengan nama dan deskripsi valid',
    endpoint: 'POST /api/categories',
    expectedStatus: 201,
  },
  {
    id: 'TC-CAT-02',
    acceptanceCriteria: 'AC-01',
    type: 'positive',
    title: 'Menambahkan kategori baru tanpa deskripsi (deskripsi opsional)',
    endpoint: 'POST /api/categories',
    expectedStatus: 201,
  },
  {
    id: 'TC-CAT-03',
    acceptanceCriteria: 'AC-02',
    type: 'positive',
    title: 'Menampilkan seluruh daftar kategori jasa yang tersimpan',
    endpoint: 'GET /api/categories',
    expectedStatus: 200,
  },
  {
    id: 'TC-CAT-04',
    acceptanceCriteria: 'AC-02',
    type: 'positive',
    title: 'Menampilkan kondisi daftar kosong (empty state)',
    endpoint: 'GET /api/categories',
    expectedStatus: 200,
  },
  {
    id: 'TC-CAT-05',
    acceptanceCriteria: 'AC-02',
    type: 'negative',
    title: 'Mengambil detail kategori berdasarkan ID tidak ditemukan',
    endpoint: 'GET /api/categories/:id',
    expectedStatus: 404,
    expectedCode: 'CATEGORY_NOT_FOUND',
  },
  {
    id: 'TC-CAT-06',
    acceptanceCriteria: 'AC-03',
    type: 'positive',
    title: 'Memperbarui nama dan deskripsi kategori yang sudah ada',
    endpoint: 'PATCH /api/categories/:id',
    expectedStatus: 200,
  },
  {
    id: 'TC-CAT-07',
    acceptanceCriteria: 'AC-03',
    type: 'negative',
    title: 'Menolak pembaruan kategori dengan ID yang tidak terdaftar',
    endpoint: 'PATCH /api/categories/:id',
    expectedStatus: 404,
    expectedCode: 'CATEGORY_NOT_FOUND',
  },
  {
    id: 'TC-CAT-08',
    acceptanceCriteria: 'AC-03',
    type: 'negative',
    title: 'Menolak deskripsi kategori yang melebihi 350 karakter',
    endpoint: 'POST /api/categories',
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
  {
    id: 'TC-CAT-09',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Menolak nama kategori kosong atau kurang dari 2 karakter',
    endpoint: 'POST /api/categories',
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
  {
    id: 'TC-CAT-10',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Menolak nama kategori duplikat secara case-insensitive',
    endpoint: 'POST /api/categories',
    expectedStatus: 409,
    expectedCode: 'CATEGORY_NAME_EXISTS',
  },
  {
    id: 'TC-CAT-11',
    acceptanceCriteria: 'AC-04',
    type: 'positive',
    title: 'Menghapus kategori yang tidak digunakan oleh layanan jasa (usageCount = 0)',
    endpoint: 'DELETE /api/categories/:id',
    expectedStatus: 200,
  },
  {
    id: 'TC-CAT-12',
    acceptanceCriteria: 'AC-04',
    type: 'negative',
    title: 'Menolak penghapusan kategori yang masih terhubung ke layanan jasa (usageCount > 0)',
    endpoint: 'DELETE /api/categories/:id',
    expectedStatus: 409,
    expectedCode: 'CATEGORY_IN_USE',
  },
  {
    id: 'TC-CAT-13',
    acceptanceCriteria: 'AC-01',
    type: 'negative',
    title: 'Menolak operasi mutasi kategori oleh pengguna yang belum login',
    endpoint: 'POST /api/categories',
    expectedStatus: 401,
    expectedCode: 'NO_SESSION',
  },
  {
    id: 'TC-CAT-14',
    acceptanceCriteria: 'AC-04',
    type: 'negative',
    title: 'Menolak operasi mutasi kategori oleh pengguna non-admin (customer/provider)',
    endpoint: 'DELETE /api/categories/:id',
    expectedStatus: 403,
    expectedCode: 'FORBIDDEN',
  },
]

describe('TPR-1 / TPR-127: Penyusunan Test Case Pengelolaan Kategori Jasa', () => {
  it('Memiliki 14 skenario test case terstruktur (TC-CAT-01 s.d. TC-CAT-14) dengan ID unik', () => {
    assert.equal(TPR_127_CATEGORY_TEST_CASES.length, 14)

    const ids = TPR_127_CATEGORY_TEST_CASES.map((tc) => tc.id)
    const uniqueIds = new Set(ids)
    assert.equal(uniqueIds.size, 14)
    assert.equal(ids[0], 'TC-CAT-01')
    assert.equal(ids[13], 'TC-CAT-14')
  })

  it('Mencakup seluruh 5 Acceptance Criteria TPR-1 (AC-01 s.d. AC-05)', () => {
    const coveredCriteria = new Set(
      TPR_127_CATEGORY_TEST_CASES.map((tc) => tc.acceptanceCriteria)
    )

    assert.deepEqual(
      Array.from(coveredCriteria).sort(),
      ['AC-01', 'AC-02', 'AC-03', 'AC-04', 'AC-05']
    )
  })

  it('Mencakup kombinasi skenario uji positif (CRUD normal) dan negatif (validasi, duplikat, relasi, otorisasi)', () => {
    const positiveCases = TPR_127_CATEGORY_TEST_CASES.filter(
      (tc) => tc.type === 'positive'
    )
    const negativeCases = TPR_127_CATEGORY_TEST_CASES.filter(
      (tc) => tc.type === 'negative'
    )

    assert.equal(positiveCases.length, 6)
    assert.equal(negativeCases.length, 8)
  })

  it('Memverifikasi aturan normalisasi nama kategori pada data uji duplikat (TC-CAT-10)', () => {
    const existingName = 'Servis Elektronik & AC'
    const candidateInput = '  servis   elektronik & ac  '

    assert.equal(
      normalizeCategoryName(existingName),
      normalizeCategoryName(candidateInput)
    )
  })
})

